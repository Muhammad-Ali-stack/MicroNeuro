import Groq from 'groq-sdk';

const EXTRACTION_SYSTEM_PROMPT = `You classify and extract actionable information from email.
Return only valid JSON with this shape:
{
  "emailType": "meeting" | "deadline" | "action-request" | "other",
  "meeting": { "subject": string|null, "date": string|null, "time": string|null, "participants": string[], "agenda": string|null }|null,
  "deadline": { "description": string|null, "dueDate": string|null }|null,
  "actionRequest": { "description": string|null, "owner": string|null, "timeline": string|null }|null
}
Use null for uncertain scalar fields and [] when there are no known participants.
Classify promotional, banking, security, and automated emails as "other".
Classify an email as a meeting only when it clearly concerns a meeting, appointment, or event.
Classify an email as a deadline only when it contains a concrete due date or due time.
Classify an email as an action-request only when it asks someone to do something.
Use the supplied received timestamp as context for resolving relative dates.`;

function parseJsonContent(content) {
  const cleaned = String(content || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(cleaned);
}

export async function extractEmailInfo(emailSubject, emailBody, emailFrom, receivedDateTime) {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            subject: emailSubject || null,
            from: emailFrom || null,
            receivedDateTime: receivedDateTime || null,
            body: String(emailBody || '').slice(0, 30000),
          }),
        },
      ],
    });

    const extracted = parseJsonContent(response.choices?.[0]?.message?.content);
    const emailType = ['meeting', 'deadline', 'action-request', 'other'].includes(extracted.emailType)
      ? extracted.emailType
      : 'other';
    return {
      emailType,
      meeting: extracted.meeting || null,
      deadline: extracted.deadline || null,
      actionRequest: extracted.actionRequest || null,
    };
  } catch (error) {
    console.warn(`Email extraction failed; classifying as other: ${error.message}`);
    return { emailType: 'other', meeting: null, deadline: null, actionRequest: null };
  }
}