import Groq from 'groq-sdk';

const ASSISTANT_SYSTEM_PROMPT = `You classify a user's natural-language assistant request and extract structured parameters.
Return ONLY valid JSON.

Current date/time context is supplied as currentDateTimeISO. Resolve relative dates and times
("tomorrow", "next Thursday", "in 2 days", "at 3pm") into concrete ISO 8601 values based on that context.

If conversation history is provided, treat the current user message as additional information for the SAME request being built up across the conversation — merge all details from every user message in the history with the current message to determine the complete set of parameters. Do not treat the current message as a new, standalone request.

Classify the request as exactly one intent:
- "create_meeting" — schedule a calendar meeting or event
- "send_email" — compose and send an email
- "create_deadline_reminder" — set a personal deadline reminder
- "unknown" — anything else or unclear

Parameter shapes when all required fields are present and unambiguous:
- create_meeting: { "subject": string, "date": ISO date string, "startTime": ISO datetime string, "endTime": ISO datetime string (optional — if omitted, the server defaults the meeting to 30 minutes from startTime), "attendees": string[] (names or emails), "location": string|null (optional) }
- send_email: { "to": string[] (email addresses), "subject": string, "body": string }
- create_deadline_reminder: { "description": string, "dueDate": ISO date or datetime string }

If the intent is clear but required fields are missing or ambiguous, respond with:
{ "intent": "<intent>", "needsClarification": true, "missingFields": ["fieldName", ...] }

If all required fields are present, respond with:
{ "intent": "<intent>", "params": { ... }, "needsClarification": false }

For "unknown", respond with:
{ "intent": "unknown", "needsClarification": false }

Required fields for create_meeting are subject, date, startTime, and attendees. endTime and location are optional: when the prompt gives a start time without an end time, omit endTime and the server will default the meeting to a 30-minute duration starting at startTime. Never ask for clarification about endTime or location.
- create_meeting: subject, date, startTime, attendees
- send_email: to, subject, body
- create_deadline_reminder: description, dueDate

Do not guess missing values. Use needsClarification when information is incomplete.`;

const REQUIRED_FIELDS = {
  create_meeting: ['subject', 'date', 'startTime', 'attendees'],
  send_email: ['to', 'subject', 'body'],
  create_deadline_reminder: ['description', 'dueDate'],
};

function parseJsonContent(content) {
  const cleaned = String(content || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(cleaned);
}

function isPresent(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function findMissingFields(intent, params = {}) {
  const required = REQUIRED_FIELDS[intent];
  if (!required) return [];
  return required.filter(field => !isPresent(params[field]));
}

function defaultEndTimeForMeeting(params) {
  if (!params || !isPresent(params.startTime) || isPresent(params.endTime)) return params;
  const start = new Date(params.startTime);
  if (Number.isNaN(start.getTime())) return params;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { ...params, endTime: end.toISOString() };
}

function sanitizeMissingFields(intent, fields) {
  const required = REQUIRED_FIELDS[intent] || [];
  return (fields || []).filter(field => required.includes(field));
}

function normalizeInterpretation(parsed) {
  const intent = ['create_meeting', 'send_email', 'create_deadline_reminder', 'unknown'].includes(parsed?.intent)
    ? parsed.intent
    : 'unknown';

  if (intent === 'unknown') {
    return { intent: 'unknown', needsClarification: false };
  }

  if (parsed.needsClarification) {
    const missingFields = sanitizeMissingFields(
      intent,
      Array.isArray(parsed.missingFields)
        ? parsed.missingFields.map(String).filter(Boolean)
        : findMissingFields(intent, parsed.params || {}),
    );
    return {
      intent,
      needsClarification: true,
      missingFields: missingFields.length > 0 ? missingFields : findMissingFields(intent, parsed.params || {}),
    };
  }

  const params = parsed.params && typeof parsed.params === 'object' ? parsed.params : {};
  const resolvedParams = intent === 'create_meeting' ? defaultEndTimeForMeeting(params) : params;
  const missingFields = findMissingFields(intent, resolvedParams);
  if (missingFields.length > 0) {
    return { intent, needsClarification: true, missingFields };
  }

  return { intent, params: resolvedParams, needsClarification: false };
}

function sanitizeConversationHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      item =>
        item &&
        typeof item === 'object' &&
        ['user', 'assistant'].includes(item.role) &&
        typeof item.content === 'string' &&
        item.content.trim() !== '',
    )
    .slice(-20)
    .map(item => ({ role: item.role, content: item.content.trim() }));
}

export async function interpretPrompt(userPrompt, currentDateTimeISO, conversationHistory = []) {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const sanitizedHistory = sanitizeConversationHistory(conversationHistory);
    const messages = [
      { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
      ...sanitizedHistory,
      {
        role: 'user',
        content: JSON.stringify({
          currentDateTimeISO,
          prompt: String(userPrompt || '').trim(),
        }),
      },
    ];

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages,
    });

    const parsed = parseJsonContent(response.choices?.[0]?.message?.content);
    return normalizeInterpretation(parsed);
  } catch (error) {
    console.warn(`Assistant intent interpretation failed: ${error.message}`);
    return { intent: 'unknown', needsClarification: false };
  }
}