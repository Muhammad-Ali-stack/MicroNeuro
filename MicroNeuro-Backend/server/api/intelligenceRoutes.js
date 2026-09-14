import crypto from 'crypto';
import cron from 'node-cron';
import prisma from '../../lib/prisma.js';
import { interpretPrompt } from '../../services/assistantIntent.js';
import {
  ensureDatabaseUser,
  ensureActiveConnectedAccount,
  parseToolResult,
  processNotification,
  sendDeadlineAlert,
  syncInbox,
} from '../../services/intelligence.js';
import { createEventTool } from '../tools/calendar/createEvent.js';
import { listEmailsTool } from '../tools/email/listEmails.js';
import { sendEmailTool } from '../tools/email/sendEmail.js';

const WEBHOOK_RESOURCE = "/me/mailFolders('inbox')/messages";

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function currentUser(req) {
  const user = await ensureDatabaseUser(req.session.manager);
  return user;
}

async function resolveActiveAccount(req) {
  const user = await currentUser(req);
  const connectedAccount = await ensureActiveConnectedAccount(req.session.manager, user.id);
  return { user, connectedAccount };
}

async function getActiveAccountFilter(req, allAccounts) {
  const { user, connectedAccount } = await resolveActiveAccount(req);
  if (allAccounts) {
    const accountIds = await prisma.connectedAccount.findMany({
      where: { appUserId: user.id },
      select: { id: true },
    });
    return { user, connectedAccount, filter: { connectedAccountId: { in: accountIds.map(a => a.id) } } };
  }
  return { user, connectedAccount, filter: { connectedAccountId: connectedAccount.id } };
}

function normalizeSettingsPatch(body = {}) {
  const data = {};
  if (body.alertLeadTimeHours !== undefined) {
    const hours = Number(body.alertLeadTimeHours);
    if (!Number.isInteger(hours) || hours < 0 || hours > 168) {
      throw validationError('alertLeadTimeHours must be an integer between 0 and 168.');
    }
    data.alertLeadTimeHours = hours;
  }
  if (body.foldersToScan !== undefined) {
    if (!Array.isArray(body.foldersToScan) || body.foldersToScan.length === 0 ||
        body.foldersToScan.some(folder => typeof folder !== 'string' || !folder.trim())) {
      throw validationError('foldersToScan must be a non-empty array of folder names.');
    }
    data.foldersToScan = body.foldersToScan.map(folder => folder.trim()).slice(0, 20);
  }
  if (body.notifyByEmail !== undefined) {
    if (typeof body.notifyByEmail !== 'boolean') throw validationError('notifyByEmail must be a boolean.');
    data.notifyByEmail = body.notifyByEmail;
  }
  return data;
}

export function registerIntelligenceRoutes(app, { requireSession, store }) {
  app.post('/api/v1/sync/inbox', requireSession, async (req, res, next) => {
    try {
      const { user, connectedAccount } = await resolveActiveAccount(req);
      const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
      res.json({ data: await syncInbox(req.session.manager, user.id, settings?.foldersToScan || ['inbox'], connectedAccount.id) });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/dashboard/summary', requireSession, async (req, res, next) => {
    try {
      const allAccounts = req.query.allAccounts === 'true';
      const { user, filter } = await getActiveAccountFilter(req, allAccounts);
      const [meetings, deadlines, actionItems, recentEmails] = await Promise.all([
        prisma.meeting.findMany({ where: { ...filter, email: { userId: user.id } }, orderBy: { email: { processedAt: 'desc' } }, take: 5, include: { email: true } }),
        prisma.deadline.findMany({ where: { ...filter, userId: user.id }, orderBy: { dueDate: 'desc' }, take: 5, include: { email: true } }),
        prisma.actionItem.findMany({ where: { ...filter, email: { userId: user.id } }, orderBy: { email: { processedAt: 'desc' } }, take: 5, include: { email: true } }),
        prisma.processedEmail.findMany({ where: { ...filter, userId: user.id }, orderBy: { processedAt: 'desc' }, take: 5 }),
      ]);
      const [meetingCount, deadlineCount, actionItemCount, unreadAlertCount] = await Promise.all([
        prisma.meeting.count({ where: { ...filter, email: { userId: user.id } } }),
        prisma.deadline.count({ where: { ...filter, userId: user.id } }),
        prisma.actionItem.count({ where: { ...filter, email: { userId: user.id } } }),
        prisma.alert.count({ where: { userId: user.id, isRead: false } }),
      ]);
      res.json({ data: {
        counts: { meetings: meetingCount, deadlines: deadlineCount, actionItems: actionItemCount, unreadAlerts: unreadAlertCount },
        recent: { meetings, deadlines, actionItems, emails: recentEmails },
      } });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/meetings', requireSession, async (req, res, next) => {
    try {
      const allAccounts = req.query.allAccounts === 'true';
      const { user, filter } = await getActiveAccountFilter(req, allAccounts);
      const where = { ...filter, email: { userId: user.id } };
      if (req.query.status) where.momStatus = String(req.query.status);
      res.json({ data: await prisma.meeting.findMany({ where, orderBy: [{ date: 'asc' }, { id: 'asc' }], include: { email: true } }) });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/deadlines', requireSession, async (req, res, next) => {
    try {
      const allAccounts = req.query.allAccounts === 'true';
      const { user, filter } = await getActiveAccountFilter(req, allAccounts);
      const where = { ...filter, userId: user.id };
      if (req.query.status) where.status = String(req.query.status);
      res.json({ data: await prisma.deadline.findMany({ where, orderBy: { dueDate: 'asc' }, include: { email: true } }) });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/action-items', requireSession, async (req, res, next) => {
    try {
      const allAccounts = req.query.allAccounts === 'true';
      const { user, filter } = await getActiveAccountFilter(req, allAccounts);
      res.json({ data: await prisma.actionItem.findMany({
        where: { ...filter, email: { userId: user.id } },
        orderBy: { id: 'desc' },
        include: { email: true },
      }) });
    } catch (error) { next(error); }
  });

  app.patch('/api/v1/action-items/:id', requireSession, async (req, res, next) => {
    try {
      const allAccounts = req.query.allAccounts === 'true';
      const { user, filter } = await getActiveAccountFilter(req, allAccounts);
      if (!['open', 'done'].includes(req.body?.status)) throw validationError('status must be open or done.');
      const item = await prisma.actionItem.findFirst({ where: { id: req.params.id, ...filter, email: { userId: user.id } } });
      if (!item) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Action item not found.' } });
      res.json({ data: await prisma.actionItem.update({ where: { id: item.id }, data: { status: req.body.status }, include: { email: true } }) });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/alerts', requireSession, async (req, res, next) => {
    try {
      const user = await currentUser(req);
      const where = { userId: user.id };
      if (req.query.unreadOnly === 'true' || req.query.unreadOnly === '1') where.isRead = false;
      res.json({ data: await prisma.alert.findMany({ where, orderBy: { createdAt: 'desc' } }) });
    } catch (error) { next(error); }
  });

  app.patch('/api/v1/alerts/:id/read', requireSession, async (req, res, next) => {
    try {
      const user = await currentUser(req);
      const alert = await prisma.alert.findFirst({ where: { id: req.params.id, userId: user.id } });
      if (!alert) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found.' } });
      res.json({ data: await prisma.alert.update({ where: { id: alert.id }, data: { isRead: true } }) });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/settings', requireSession, async (req, res, next) => {
    try {
      const user = await currentUser(req);
      res.json({ data: await prisma.settings.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      }) });
    } catch (error) { next(error); }
  });

  app.patch('/api/v1/settings', requireSession, async (req, res, next) => {
    try {
      const user = await currentUser(req);
      const data = normalizeSettingsPatch(req.body);
      res.json({ data: await prisma.settings.upsert({
        where: { userId: user.id },
        update: data,
        create: { userId: user.id, ...data },
      }) });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/assistant/prompt', requireSession, async (req, res, next) => {
    try {
      const prompt = String(req.body?.prompt || '').trim();
      if (!prompt) throw validationError('prompt is required.');

      const user = await currentUser(req);
      const conversationHistory = Array.isArray(req.body?.conversationHistory) ? req.body.conversationHistory : [];
      const interpretation = await interpretPrompt(prompt, new Date().toISOString(), conversationHistory);
      const completionStatus = conversationHistory.length > 0 ? 'ready' : 'completed';

      if (interpretation.needsClarification) {
        const missing = Array.isArray(interpretation.missingFields) ? interpretation.missingFields : [];
        return res.json({
          data: {
            status: 'needs_clarification',
            missingFields: missing,
            message: `I need a bit more info: ${missing.join(', ')}`,
          },
        });
      }

      if (interpretation.intent === 'create_meeting') {
        const params = interpretation.params || {};
        const attendees = Array.isArray(params.attendees) ? params.attendees.map(String) : [];
        const startValue = params.startTime || params.date;
        let endValue = params.endTime || startValue;
        if (params.startTime && !params.endTime) {
          const startMs = new Date(params.startTime).getTime();
          if (!Number.isNaN(startMs)) endValue = new Date(startMs + 30 * 60 * 1000).toISOString();
        }

        const toolResult = await createEventTool(req.session.manager, {
          subject: String(params.subject || ''),
          start: { dateTime: new Date(startValue).toISOString(), timeZone: 'UTC' },
          end: { dateTime: new Date(endValue).toISOString(), timeZone: 'UTC' },
          attendees,
          location: params.location || '',
          body: '',
          bodyType: 'text',
          preserveUserStyling: false,
        });

        const result = parseToolResult(toolResult);
        return res.json({ data: { status: completionStatus, action: 'create_meeting', result } });
      }

      if (interpretation.intent === 'send_email') {
        const params = interpretation.params || {};
        const to = Array.isArray(params.to) ? params.to.map(String) : [];
        const toolResult = await sendEmailTool(req.session.manager, {
          to,
          subject: String(params.subject || ''),
          body: String(params.body || ''),
          bodyType: 'text',
          preserveUserStyling: false,
        });

        const result = parseToolResult(toolResult);
        return res.json({ data: { status: completionStatus, action: 'send_email', result } });
      }

      if (interpretation.intent === 'create_deadline_reminder') {
        const params = interpretation.params || {};
        const dueDate = new Date(params.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
          throw validationError('dueDate could not be parsed from the prompt.');
        }
        const deadline = await prisma.deadline.create({
          data: {
            userId: user.id,
            description: String(params.description || ''),
            dueDate,
            status: 'upcoming',
          },
        });
        return res.json({ data: { status: completionStatus, action: 'create_deadline_reminder', result: deadline } });
      }

      return res.json({
        data: {
          status: 'unknown',
          message: "I couldn't understand that request. Try something like 'schedule a meeting with X tomorrow at 3pm' or 'send an email to X about Y'.",
        },
      });
    } catch (error) {
      console.error('Assistant prompt handling failed:', error);
      next(error);
    }
  });

  app.post('/api/v1/webhooks/outlook/subscribe', requireSession, async (req, res, next) => {
    try {
      if (!process.env.PUBLIC_BASE_URL) {
        throw validationError('PUBLIC_BASE_URL is required to create an Outlook webhook subscription.');
      }
      const user = await currentUser(req);
      await req.session.manager.ensureAuthenticated();
      const expiresAt = new Date(Date.now() + 4230 * 60 * 1000);
      const graph = req.session.manager.getGraphApiClient();
      const subscription = await graph.postWithRetry('/subscriptions', {
        changeType: 'created',
        notificationUrl: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/v1/webhooks/outlook/notifications`,
        resource: WEBHOOK_RESOURCE,
        expirationDateTime: expiresAt.toISOString(),
        clientState: process.env.WEBHOOK_CLIENT_STATE || undefined,
      });
      const saved = await prisma.webhookSubscription.create({
        data: {
          userId: user.id,
          graphSubscriptionId: subscription.id,
          resource: subscription.resource || WEBHOOK_RESOURCE,
          expiresAt: new Date(subscription.expirationDateTime || expiresAt),
        },
      });
      res.json({ data: saved });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/webhooks/outlook/notifications', async (req, res, next) => {
    if (req.query.validationToken) return res.type('text/plain').status(200).send(String(req.query.validationToken));
    const notifications = Array.isArray(req.body?.value) ? req.body.value : [];
    res.status(202).send();
    for (const notification of notifications) {
      try {
        const subscription = await prisma.webhookSubscription.findUnique({
          where: { graphSubscriptionId: notification.subscriptionId },
        });
        if (!subscription) continue;
        const session = store.findByUserId(subscription.userId);
        if (!session) {
          console.warn(`Webhook ${subscription.graphSubscriptionId} received without an active authenticated session.`);
          continue;
        }
        await processNotification(session.manager, subscription.userId, notification.resource);
      } catch (error) {
        console.error('Outlook webhook processing failed:', error.message);
      }
    }
  });
}

async function runDeadlineAlerts(store) {
  try {
    const now = new Date();
    await prisma.deadline.updateMany({ where: { dueDate: { lt: now }, status: 'upcoming' }, data: { status: 'overdue' } });
    const users = await prisma.user.findMany({ include: { settings: true } });
    for (const user of users) {
      const leadHours = user.settings?.alertLeadTimeHours ?? 24;
      const cutoff = new Date(now.getTime() + leadHours * 60 * 60 * 1000);
      const deadlines = await prisma.deadline.findMany({
        where: { userId: user.id, status: 'upcoming', dueDate: { gte: now, lte: cutoff } },
        orderBy: { dueDate: 'asc' },
      });
      const session = store.findByUserId(user.id);
      for (const deadline of deadlines) {
        const existing = await prisma.alert.findFirst({ where: { userId: user.id, sourceType: 'deadline', sourceId: deadline.id, isRead: false } });
        if (existing) continue;
        const alert = await prisma.alert.create({
          data: { userId: user.id, sourceType: 'deadline', sourceId: deadline.id, message: `Upcoming deadline: ${deadline.description}` },
        });
        if (user.settings?.notifyByEmail && session) {
          await sendDeadlineAlert(session.manager, user.email, deadline).catch(error => console.error(`Could not email alert ${alert.id}:`, error.message));
        }
      }
    }
  } catch (error) {
    console.error('Deadline alert job failed:', error.message);
  }
}

export function startIntelligenceJobs(store) {
  const hourly = cron.schedule('0 * * * *', () => runDeadlineAlerts(store));
  const daily = cron.schedule('0 3 * * *', async () => {
    const expiring = await prisma.webhookSubscription.findMany({ where: { expiresAt: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) } } });
    for (const subscription of expiring) {
      const session = store.findByUserId(subscription.userId);
      if (!session) continue;
      try {
        await session.manager.ensureAuthenticated();
        const graph = session.manager.getGraphApiClient();
        const renewed = await graph.patchWithRetry(`/subscriptions/${subscription.graphSubscriptionId}`, {
          expirationDateTime: new Date(Date.now() + 4230 * 60 * 1000).toISOString(),
        });
        await prisma.webhookSubscription.update({
          where: { id: subscription.id },
          data: { expiresAt: new Date(renewed.expirationDateTime) },
        });
      } catch (error) {
        console.error(`Could not renew webhook ${subscription.graphSubscriptionId}:`, error.message);
      }
    }
  });
  return { stop: () => { hourly.stop(); daily.stop(); } };
}