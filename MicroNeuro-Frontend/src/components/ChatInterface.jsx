import { useState } from 'react'
import { CheckCircle2, Send, Sparkles, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { apiError, postData } from '../lib/api'

const suggestions = [
  'What needs my attention today?',
  'Schedule a meeting for tomorrow',
  'Find my upcoming deadlines',
]

function messageText(response) {
  if (response?.message) return response.message
  if (response?.result?.text) return response.result.text
  if (response?.status === 'completed') return `Completed: ${response.action?.replaceAll('_', ' ') || 'request'}`
  return 'I could not find an answer.'
}

export default function ChatInterface({ compact = false }) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)

  async function submit(value = prompt) {
    const text = value.trim()
    if (!text || sending) return

    const history = messages.map(message => ({ role: message.role, content: message.text }))
    setPrompt('')
    setMessages(current => [...current, { role: 'user', text }])
    setSending(true)

    try {
      const response = await postData('/assistant/prompt', { prompt: text, conversationHistory: history })
      const responseMessage = { role: 'assistant', text: messageText(response), status: response?.status, action: response?.action }
      setMessages(current => [...current, responseMessage])
    } catch (error) {
      toast.error(apiError(error))
      setMessages(current => [...current, { role: 'assistant', text: 'The assistant could not complete that request.', status: 'error' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`chat-interface ${compact ? 'chat-interface-compact' : ''}`}>
      {!compact && (
        <div className="assistant-intro">
          <div className="ai-orb"><Sparkles size={26} /></div>
          <h2>What can I help you with?</h2>
          <p>Ask about your inbox, meetings, deadlines, or action items.</p>
        </div>
      )}

      {messages.length > 0 && (
        <div className="chat-messages" aria-live="polite">
          {messages.map((message, index) => (
            <div className={`chat-entry ${message.role}`} key={`${message.role}-${index}`}>
              <div className={`chat-bubble ${message.role}`}>
                {message.status === 'completed' && <CheckCircle2 size={14} />}
                {message.status === 'needs_clarification' && <TriangleAlert size={14} />}
                {message.text}
              </div>
            </div>
          ))}
          {sending && <div className="chat-entry assistant"><div className="chat-bubble assistant">Thinking...</div></div>}
        </div>
      )}

      {!compact && (
        <div className="suggestions">
          {suggestions.map(suggestion => (
            <button type="button" key={suggestion} onClick={() => submit(suggestion)} disabled={sending}>
              <Sparkles size={13} /> {suggestion}
            </button>
          ))}
        </div>
      )}

      <form className="chat-input" onSubmit={event => { event.preventDefault(); submit() }}>
        <textarea value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() } }} placeholder="Ask MicroNeuro anything..." aria-label="Ask MicroNeuro" rows={compact ? 2 : 1} disabled={sending} />
        <button className="send-button" type="submit" disabled={!prompt.trim() || sending} title="Send prompt" aria-label="Send prompt"><Send size={15} /></button>
      </form>
      {!compact && <small className="chat-disclaimer">MicroNeuro can make mistakes. Check important details.</small>}
    </div>
  )
}
