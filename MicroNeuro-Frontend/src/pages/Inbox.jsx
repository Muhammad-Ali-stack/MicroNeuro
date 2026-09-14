import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Search, ChevronDown, Inbox as InboxIcon, Trash2, Reply, Flag, Plus, Forward, Archive, Paperclip, Download, Users, FolderInput, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { getData, postData, patchData, deleteData, apiError } from '../lib/api'
import { OutlookIcon, MailBrandIcon } from '../components/BrandIcons'

const FOLDERS = ['inbox', 'sentitems', 'drafts', 'deleteditems', 'junkemail', 'archive']

function folderLabel(folder) {
  return { inbox: 'Inbox', sentitems: 'Sent items', drafts: 'Drafts', deleteditems: 'Deleted items', junkemail: 'Junk email', archive: 'Archive' }[folder] || folder
}

function folderDescription(folder) {
  return { inbox: 'Focused messages waiting for you', sentitems: 'Messages you have sent', drafts: 'Unfinished messages', deleteditems: 'Removed messages', junkemail: 'Filtered unwanted mail', archive: 'Stored messages' }[folder] || ''
}

function personLabel(value) {
  if (!value) return 'Unknown sender'
  if (typeof value === 'string') return value
  const person = value.emailAddress || value
  if (person.name && person.address) return `${person.name} <${person.address}>`
  return person.name || person.address || 'Unknown sender'
}

export default function Inbox() {
  const [folder, setFolder] = useState('inbox')
  const [messages, setMessages] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [replying, setReplying] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' })
  const [query, setQuery] = useState('')
  const [folderOpen, setFolderOpen] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [attachmentLoading, setAttachmentLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [forwardOpen, setForwardOpen] = useState(false)
  const [forwardTo, setForwardTo] = useState('')

  useEffect(() => {
    function closeModals(event) {
      if (event.key === 'Escape') {
        setSelected(null)
        setComposeOpen(false)
        setFolderOpen(false)
      }
    }
    document.addEventListener('keydown', closeModals)
    return () => document.removeEventListener('keydown', closeModals)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const endpoint = query.trim()
      ? `/outlook/messages/search?query=${encodeURIComponent(query.trim())}&limit=25`
      : `/outlook/messages?folder=${folder}&limit=25`
    getData(endpoint)
      .then(setMessages)
      .catch(e => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }, [folder, query])

  useEffect(() => { load() }, [load])

  async function toggleRead(m) {
    try {
      await patchData(`/outlook/messages/${m.id}/read`, { isRead: !m.isRead })
      load()
    } catch (e) { toast.error(apiError(e)) }
  }

  async function remove(m) {
    try {
      await deleteData(`/outlook/messages/${m.id}`)
      toast.success('Message deleted')
      setSelected(null)
      load()
    } catch (e) { toast.error(apiError(e)) }
  }

  async function openMessage(message) {
    setSelected(message)
    setReplyBody('')
    setDetailLoading(true)
    try {
      const [detail, attachmentResult] = await Promise.all([
        getData(`/outlook/messages/${encodeURIComponent(message.id)}`),
        getData(`/outlook/messages/${encodeURIComponent(message.id)}/attachments`).catch(() => null),
      ])
      setSelected(current => ({ ...current, ...detail }))
      setAttachments(attachmentResult?.attachments || attachmentResult?.value || attachmentResult || [])
    } catch (e) {
      toast.error(apiError(e))
    } finally {
      setDetailLoading(false)
    }
  }

  async function messageAction(action, body) {
    if (!selected?.id || actionBusy) return
    setActionBusy(true)
    try {
      if (action === 'archive') await postData(`/outlook/messages/${encodeURIComponent(selected.id)}/archive`)
      if (action === 'replyAll') await postData(`/outlook/messages/${encodeURIComponent(selected.id)}/reply-all`, body)
      if (action === 'forward') await postData(`/outlook/messages/${encodeURIComponent(selected.id)}/forward`, body)
      if (action === 'move') await postData(`/outlook/messages/${encodeURIComponent(selected.id)}/move`, body)
      if (action === 'flag') await patchData(`/outlook/messages/${encodeURIComponent(selected.id)}/flag`, body)
      if (action === 'categories') await patchData(`/outlook/messages/${encodeURIComponent(selected.id)}/categories`, body)
      toast.success(action === 'archive' ? 'Message archived' : 'Message updated')
      if (action === 'archive' || action === 'move') { setSelected(null); load() }
    } catch (e) { toast.error(apiError(e)) } finally { setActionBusy(false) }
  }

  async function downloadAttachment(attachment) {
    try {
      const result = await getData(`/outlook/messages/${encodeURIComponent(selected.id)}/attachments/${encodeURIComponent(attachment.id)}`, { includeContent: true, decodeContent: false })
      const base64 = result?.contentBytes || result?.content || attachment.contentBytes
      if (!base64) return toast.error('Attachment content was not returned')
      const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
      const blob = new Blob([bytes], { type: attachment.contentType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.name || 'attachment'
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) { toast.error(apiError(e)) }
  }

  async function uploadAttachment(event) {
    const file = event.target.files?.[0]
    if (!file || !selected?.id) return
    setAttachmentLoading(true)
    try {
      const contentBytes = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await postData(`/outlook/messages/${encodeURIComponent(selected.id)}/attachments`, { name: file.name, contentType: file.type || 'application/octet-stream', contentBytes })
      toast.success('Attachment added')
    } catch (e) { toast.error(apiError(e)) } finally { setAttachmentLoading(false); event.target.value = '' }
  }

  async function forwardMessage(event) {
    event.preventDefault()
    const recipients = forwardTo.split(/[;,\s]+/).map(value => value.trim()).filter(Boolean)
    if (!recipients.length || !selected?.id || actionBusy) return toast.error('Enter at least one recipient')
    setActionBusy(true)
    try {
      await postData(`/outlook/messages/${encodeURIComponent(selected.id)}/forward`, { to: recipients, body: replyBody.trim(), bodyType: 'text' })
      toast.success('Message forwarded')
      setForwardOpen(false)
      setForwardTo('')
    } catch (error) { toast.error(apiError(error)) } finally { setActionBusy(false) }
  }

  async function replyToMessage(event) {
    event.preventDefault()
    if (!selected?.id || !replyBody.trim() || replying) return
    setReplying(true)
    try {
      await postData(`/outlook/messages/${encodeURIComponent(selected.id)}/reply`, {
        body: replyBody.trim(),
        bodyType: 'text',
      })
      toast.success('Reply sent')
      setReplyBody('')
      setSelected(null)
    } catch (e) {
      toast.error(apiError(e))
    } finally {
      setReplying(false)
    }
  }

  async function sendMessage(event) {
    event.preventDefault()
    const recipients = compose.to.split(/[;,\s]+/).map(value => value.trim()).filter(Boolean)
    if (!recipients.length || !compose.subject.trim() || !compose.body.trim() || sending) {
      toast.error('Recipient, subject, and message are required')
      return
    }
    setSending(true)
    try {
      await postData('/outlook/messages/send', { to: recipients, subject: compose.subject.trim(), body: compose.body.trim(), bodyType: 'text' })
      toast.success('Email sent')
      setCompose({ to: '', subject: '', body: '' })
      setComposeOpen(false)
    } catch (e) { toast.error(apiError(e)) } finally { setSending(false) }
  }

  async function saveDraft(event) {
    event.preventDefault()
    const recipients = compose.to.split(/[;,\s]+/).map(value => value.trim()).filter(Boolean)
    if (!recipients.length || !compose.subject.trim()) return toast.error('Recipient and subject are required for a draft')
    try {
      await postData('/outlook/drafts', { to: recipients, subject: compose.subject.trim(), body: compose.body, bodyType: 'text' })
      toast.success('Draft saved')
      setComposeOpen(false)
    } catch (e) { toast.error(apiError(e)) }
  }

  function messageBody(message) {
    return message.body?.content || message.body?.text || message.bodyContent || message.content || message.bodyPreview || message.preview || 'No content available.'
  }

  const rows = messages?.emails || []

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><OutlookIcon size={14} /> Microsoft Outlook</div>
          <h1>Inbox</h1>
          <p>All your important messages, without the noise.</p>
        </div>
        <div className="page-actions"><button className="button button-dark" onClick={() => setComposeOpen(true)}><Plus size={16} /> New email</button><button className="button button-light" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
      </div>

      <div className="filter-row">
        <div className="folder-picker">
          <button className="folder-select" type="button" onClick={() => setFolderOpen(value => !value)} aria-haspopup="listbox" aria-expanded={folderOpen}>
            <MailBrandIcon size={15} />
            <span><small>Current folder</small><strong>{folderLabel(folder)}</strong></span>
            <ChevronDown size={14} className={folderOpen ? 'rotate-180' : ''} />
          </button>
          {folderOpen && <div className="folder-menu" role="listbox">{FOLDERS.map(value => <button key={value} type="button" className={`folder-option ${folder === value ? 'active' : ''}`} onClick={() => { setQuery(''); setFolder(value); setFolderOpen(false) }}><MailBrandIcon size={15} /><span>{folderLabel(value)}<small>{folderDescription(value)}</small></span>{folder === value && <span className="folder-check">✓</span>}</button>)}</div>}
        </div>
        <div className="search compact">
          <Search size={15} />
          <input placeholder="Search messages" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
      </div>

      <section className="panel inbox-panel">
        {loading ? (
          <div className="loading"><RefreshCw className="spin" /> Loading messages…</div>
        ) : rows.length ? rows.map((m, i) => (
          <div className={`message-row ${m.isRead === false ? 'unread' : ''}`} key={m.id || i} onClick={() => openMessage(m)} style={{ cursor: 'pointer' }}>
            <span className="message-dot" />
            <div className="sender-avatar">{personLabel(m.from)[0]}</div>
            <div className="message-copy">
              <strong>{personLabel(m.from)}</strong>
              <span>{m.subject || '(no subject)'}</span>
              <p>{m.preview || 'No preview available.'}</p>
            </div>
            <time>{m.receivedDateTime ? new Date(m.receivedDateTime).toLocaleDateString() : '—'}</time>
            <button className="icon-button" onClick={(e) => { e.stopPropagation(); toggleRead(m) }} title="Toggle read"><Flag size={15} /></button>
            <button className="icon-button" onClick={(e) => { e.stopPropagation(); remove(m) }} title="Delete"><Trash2 size={15} /></button>
          </div>
        )) : (
          <div className="empty">
            <div className="empty-icon"><InboxIcon size={24} /></div>
            <h3>Your inbox is quiet</h3>
            <p>Connect Outlook and sync to bring your messages here.</p>
          </div>
        )}
      </section>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{selected.subject || '(no subject)'}</h3>
              <button className="icon-button" onClick={() => setSelected(null)}>×</button>
            </div>
            <p className="modal-meta">{personLabel(selected.from)} · {selected.receivedDateTime ? new Date(selected.receivedDateTime).toLocaleString() : ''}</p>
            <div className="modal-body email-content">{detailLoading ? 'Loading message...' : messageBody(selected)}</div>
            <div className="message-tools">
              <button className="icon-button" onClick={() => { if (!replyBody.trim()) toast.error('Write a reply first'); else messageAction('replyAll', { body: replyBody.trim(), bodyType: 'text' }) }} title="Reply all"><Users size={15} /></button>
              <button className="icon-button" onClick={() => setForwardOpen(true)} title="Forward"><Forward size={15} /></button>
              <button className="icon-button" onClick={() => messageAction('archive')} title="Archive"><Archive size={15} /></button>
              <button className="icon-button" onClick={() => messageAction('flag', { flagStatus: 'flagged' })} title="Flag"><Flag size={15} /></button>
              <button className="icon-button" onClick={() => messageAction('categories', { categories: ['Follow up'] })} title="Add follow-up category"><Tags size={15} /></button>
              <button className="icon-button" onClick={() => messageAction('move', { destinationFolderId: 'archive' })} title="Move to archive"><FolderInput size={15} /></button>
              <label className="icon-button" title="Add attachment"><Paperclip size={15} /><input type="file" hidden onChange={uploadAttachment} disabled={attachmentLoading} /></label>
            </div>
            {attachments.length > 0 && <div className="attachment-list">{attachments.map(attachment => <button className="attachment-row" key={attachment.id} onClick={() => downloadAttachment(attachment)}><Paperclip size={14} /><span>{attachment.name || 'Attachment'}</span><Download size={14} /></button>)}</div>}
            <form className="reply-form" onSubmit={replyToMessage}>
              <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Write your reply..." rows={4} disabled={detailLoading || replying} />
              <div className="modal-actions">
                <button className="button button-dark" type="submit" disabled={detailLoading || replying || !replyBody.trim()}><Reply size={15} /> {replying ? 'Sending...' : 'Send reply'}</button>
              </div>
            </form>
            {forwardOpen && <form className="forward-form" onSubmit={forwardMessage}><label className="field"><span>Forward to</span><input value={forwardTo} onChange={event => setForwardTo(event.target.value)} placeholder="person@example.com" /></label><button className="button button-dark" type="submit" disabled={actionBusy}>{actionBusy ? 'Forwarding...' : 'Forward message'}</button></form>}
          </div>
        </div>
      )}
      {composeOpen && (
        <div className="modal-overlay" onClick={() => setComposeOpen(false)}>
          <form className="modal compose-modal" onClick={event => event.stopPropagation()} onSubmit={sendMessage}>
            <div className="modal-head"><div><span className="eyebrow">Microsoft Outlook</span><h3>New email</h3></div><button type="button" className="icon-button" onClick={() => setComposeOpen(false)} aria-label="Close">×</button></div>
            <label className="field"><span>To</span><input value={compose.to} onChange={event => setCompose(current => ({ ...current, to: event.target.value }))} placeholder="person@example.com" /></label>
            <label className="field"><span>Subject</span><input value={compose.subject} onChange={event => setCompose(current => ({ ...current, subject: event.target.value }))} placeholder="Subject" /></label>
            <label className="field"><span>Message</span><textarea value={compose.body} onChange={event => setCompose(current => ({ ...current, body: event.target.value }))} placeholder="Write your message..." rows={8} /></label>
            <div className="modal-actions"><button type="button" className="button button-light" onClick={saveDraft}>Save draft</button><button type="submit" className="button button-dark" disabled={sending}><Reply size={15} /> {sending ? 'Sending...' : 'Send email'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}