import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

class MockGroq {
  constructor() {
    this.chat = { completions: { create: mockCreate } };
  }
}

vi.mock('groq-sdk', () => ({ default: MockGroq }));
const { interpretPrompt } = await import('../../../services/assistantIntent.js');

describe('assistantIntent conversation history merge', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.GROQ_API_KEY = 'test-key';
  });

  it('sends [system, ...conversationHistory, user] to Groq', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ intent: 'unknown', needsClarification: false }) } }],
    });
    await interpretPrompt(
      'End time is 4pm, attendee is sara@example.com, no specific location',
      '2026-08-15T09:00:00.000Z',
      [
        { role: 'user', content: 'Schedule a meeting with Sara tomorrow at 3pm about the FYP demo' },
        { role: 'assistant', content: 'I need more info: endTime, attendees, location' },
      ],
    );
    const { messages } = mockCreate.mock.calls[0][0];
    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('merge all details from every user message in the history');
    expect(messages[1]).toEqual({ role: 'user', content: 'Schedule a meeting with Sara tomorrow at 3pm about the FYP demo' });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'I need more info: endTime, attendees, location' });
    expect(messages[3].role).toBe('user');
    expect(messages[3].content).toContain('End time is 4pm, attendee is sara@example.com');
  });

  it('returns complete create_meeting (not needs_clarification) after follow-up merges missing fields', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        intent: 'create_meeting',
        params: {
          subject: 'FYP demo meeting',
          date: '2026-08-16',
          startTime: '2026-08-16T15:00:00.000Z',
          endTime: '2026-08-16T16:00:00.000Z',
          attendees: ['sara@example.com'],
          location: null,
        },
        needsClarification: false,
      }) } }],
    });
    const result = await interpretPrompt(
      'End time is 4pm, attendee is sara@example.com, no specific location',
      '2026-08-15T09:00:00.000Z',
      [
        { role: 'user', content: 'Schedule a meeting with Sara tomorrow at 3pm about the FYP demo' },
        { role: 'assistant', content: 'I need more info: endTime, attendees, location' },
      ],
    );
    expect(result.needsClarification).toBe(false);
    expect(result.intent).toBe('create_meeting');
    expect(result.params).toMatchObject({
      subject: 'FYP demo meeting',
      date: '2026-08-16',
      startTime: '2026-08-16T15:00:00.000Z',
      endTime: '2026-08-16T16:00:00.000Z',
      attendees: ['sara@example.com'],
    });
  });

  it('defaults endTime to 30 minutes after startTime when omitted', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        intent: 'create_meeting',
        params: {
          subject: 'Quick sync',
          date: '2026-08-16',
          startTime: '2026-08-16T15:00:00.000Z',
          attendees: ['a@example.com'],
        },
        needsClarification: false,
      }) } }],
    });
    const result = await interpretPrompt('Schedule a quick sync with a@example.com tomorrow at 3pm', '2026-08-15T09:00:00.000Z', []);
    expect(result.needsClarification).toBe(false);
    expect(result.params.endTime).toBe('2026-08-16T15:30:00.000Z');
  });

  it('filters invalid conversation history entries', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ intent: 'unknown', needsClarification: false }) } }],
    });
    await interpretPrompt('hi', '2026-08-15T09:00:00.000Z', [
      { role: 'system', content: 'should be dropped' },
      { role: 'user', content: '' },
      null,
      { role: 'user', content: 'valid history entry' },
    ]);
    const { messages } = mockCreate.mock.calls[0][0];
    const historyMessages = messages.filter(m => m.role !== 'system');
    expect(historyMessages).toHaveLength(2);
    expect(historyMessages[0]).toEqual({ role: 'user', content: 'valid history entry' });
  });
});