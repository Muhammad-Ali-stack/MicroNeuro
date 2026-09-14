import { getEmailTool, listEmailsTool } from '../server/tools/email/listEmails.js';
import { sendEmailTool } from '../server/tools/email/sendEmail.js';
import { extractEmailInfo } from './groqExtraction.js';
import prisma from '../lib/prisma.js';

function parseToolResult(result) {
  if (!result) return null;
  if (result.isError) {
    const text = result.content?.find(item => item.type === 'text')?.text || 'Graph request failed';
    throw new Error(text);
  }
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = result.content?.find(item => item.type === 'text')?.text;
  if (text === undefined) return result;
  try { return JSON.parse(text); } catch { return { text }; }
}

function authenticatedUser(manager) {
  const record = manager.authenticationRecord;
  const email = record?.mail || record?.email;
  if (!email) throw new Error('Microsoft account does not provide an email address.');
  return { email: email.toLowerCase(), displayName: record?.displayName || null, graphId: record?.id || null };
}

export async function ensureDatabaseUser(manager) {
  const account = authenticatedUser(manager);
  const user = await prisma.user.upsert({
    where: { email: account.email },
    update: { displayName: account.displayName },
    create: { email: account.email, displayName: account.displayName },
  });
  manager.databaseUserId = user.id;
  return user;
}

export async function ensureActiveConnectedAccount(manager, appUserId) {
  const account = authenticatedUser(manager);
  let connectedAccount = await prisma.connectedAccount.findUnique({
    where: { microsoftAccountId: account.graphId || account.email },
  });
  if (!connectedAccount) {
    const count = await prisma.connectedAccount.count({ where: { appUserId } });
    connectedAccount = await prisma.connectedAccount.create({
      data: {
        appUserId,
        microsoftAccountId: account.graphId || account.email,
        email: account.email,
        displayName: account.displayName,
        isActive: count === 0,
      },
    });
  }
  manager.setActiveConnectedAccount(connectedAccount.id);
  return connectedAccount;
}

function normalizedBody(email) {
  return email?.body?.content || email?.bodyPreview || email?.preview || '';
}

function safeDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return !date || Number.isNaN(date.getTime()) ? null : date;
}

function textOrNull(value) {
  return value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim();
}

async function saveExtraction(userId, connectedAccountId, email, extracted) {
  const receivedAt = safeDate(email.receivedDateTime) || new Date();
  return prisma.processedEmail.create({
    data: {
      userId,
      connectedAccountId,
      graphMessageId: email.id,
      subject: textOrNull(email.subject),
      fromAddress: textOrNull(email.from?.address || email.from),
      receivedAt,
      emailType: extracted.emailType,
      meetings: extracted.emailType === 'meeting' && extracted.meeting
        ? {
            create: {
              connectedAccountId,
              subject: textOrNull(extracted.meeting.subject) || textOrNull(email.subject) || '(Untitled meeting)',
              date: safeDate(extracted.meeting.date, null),
              time: textOrNull(extracted.meeting.time),
              participants: Array.isArray(extracted.meeting.participants)
                ? extracted.meeting.participants.map(String).slice(0, 100)
                : [],
              agenda: textOrNull(extracted.meeting.agenda),
            },
          }
        : undefined,
      deadlines: extracted.emailType === 'deadline' && extracted.deadline && safeDate(extracted.deadline.dueDate, null)
        ? { create: {
            userId,
            connectedAccountId,
            description: textOrNull(extracted.deadline.description) || textOrNull(email.subject) || 'Email deadline',
            dueDate: safeDate(extracted.deadline.dueDate, null),
          } }
        : undefined,
      actionItems: extracted.emailType === 'action-request' && extracted.actionRequest
        ? { create: {
            connectedAccountId,
            description: textOrNull(extracted.actionRequest.description) || textOrNull(email.subject) || 'Email action request',
            owner: textOrNull(extracted.actionRequest.owner),
          } }
        : undefined,
    },
    include: { meetings: true, deadlines: true, actionItems: true },
  });
}

export async function processGraphEmail(manager, userId, email, connectedAccountId) {
  if (!email?.id) throw new Error('Graph email is missing its id.');
  const existing = await prisma.processedEmail.findUnique({ where: { graphMessageId: email.id } });
  if (existing) return { skipped: true, record: existing };

  const extracted = await extractEmailInfo(
    email.subject,
    normalizedBody(email),
    email.from?.address || email.from,
    email.receivedDateTime,
  );
  return { skipped: false, record: await saveExtraction(userId, connectedAccountId, email, extracted) };
}

export async function syncInbox(manager, userId, folders = ['inbox'], connectedAccountId) {
  await manager.ensureAuthenticated();
  const folder = folders[0] || 'inbox';
  const listed = parseToolResult(await listEmailsTool(manager, { folder, limit: 50 }));
  const messages = listed?.emails || [];
  let processed = 0;
  let skipped = 0;

  for (const listedEmail of messages) {
    try {
      const fullEmail = parseToolResult(await getEmailTool(manager, {
        messageId: listedEmail.id,
        truncate: false,
        format: 'text',
      }));
      const result = await processGraphEmail(manager, userId, {
        ...listedEmail,
        ...fullEmail,
        from: fullEmail?.from || listedEmail.from,
      }, connectedAccountId);
      if (result.skipped) skipped++;
      else processed++;
    } catch (error) {
      console.error(`Could not process Graph message ${listedEmail.id}: ${error.message}`);
    }
  }

  return { processed, skipped, total: messages.length };
}

export async function processNotification(manager, userId, resource, connectedAccountId) {
  await manager.ensureAuthenticated();
  const messageId = resource.split('/').pop();
  if (!messageId) throw new Error('Webhook notification resource does not include a message id.');
  const email = parseToolResult(await getEmailTool(manager, {
    messageId,
    truncate: false,
    format: 'text',
  }));
  return processGraphEmail(manager, userId, email, connectedAccountId);
}

export async function sendDeadlineAlert(manager, email, deadline) {
  return sendEmailTool(manager, {
    to: [email],
    subject: `Upcoming deadline: ${deadline.description}`,
    body: `Reminder: ${deadline.description}\nDue: ${deadline.dueDate.toISOString()}`,
    bodyType: 'text',
    preserveUserStyling: false,
  });
}

export { authenticatedUser, parseToolResult };