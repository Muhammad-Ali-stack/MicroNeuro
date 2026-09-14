import { useEffect, useState } from 'react'
import mammoth from 'mammoth'
import { ChevronRight, ExternalLink, FileText, FolderOpen, Mail, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { apiError, getData } from '../lib/api'
import { OneDriveIcon } from '../components/BrandIcons'

function itemsFrom(result, keys) {
  if (Array.isArray(result)) return result
  for (const key of keys) if (Array.isArray(result?.[key])) return result[key]
  return []
}

function isFolder(item, source = 'sharepoint') {
  if (source === 'outlook') return true
  return Boolean(item?.folder || item?.childFolders || item?.type === 'folder' || item?.isFolder)
}

function titleFor(item) {
  return item?.name || item?.displayName || item?.title || 'Untitled item'
}

function mimeFor(item) {
  if (item.contentType || item.mimeType || item.file?.mimeType) return item.contentType || item.mimeType || item.file.mimeType
  const name = titleFor(item).toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (name.endsWith('.doc')) return 'application/msword'
  return ''
}

function bytesFor(item) {
  const value = item.contentBytes
    || item.base64Content
    || item.contentBase64
    || item.base64
    || item.file?.contentBytes
    || item.file?.base64Content
    || item.content?.contentBytes
    || item.content?.base64Content
    || item.data?.contentBytes
    || (typeof item.content === 'string' ? item.content : '')
  const raw = value?.data || value || ''
  return typeof raw === 'string' && raw.includes(',') ? raw.split(',').pop() : raw
}

function PreviewContent({ item }) {
  const [docHtml, setDocHtml] = useState('')
  const [docLoading, setDocLoading] = useState(false)
  const contentType = mimeFor(item)
  const content = item.text
    || item.parsedText
    || item.officeDocumentText
    || item.extractedText
    || item.content?.text
    || item.content?.parsedText
    || item.body
    || item.description
  const bytes = bytesFor(item)

  useEffect(() => {
    if (!contentType.includes('wordprocessingml') || !bytes) return undefined
    let active = true
    setDocLoading(true)
    mammoth.convertToHtml({ arrayBuffer: Uint8Array.from(atob(bytes), char => char.charCodeAt(0)).buffer })
      .then(result => { if (active) setDocHtml(result.value) })
      .catch(() => { if (active) setDocHtml('') })
      .finally(() => { if (active) setDocLoading(false) })
    return () => { active = false }
  }, [contentType, bytes])

  if (contentType.startsWith('image/') && bytes) {
    return <div className="preview-content"><img className="in-app-preview-image" src={`data:${contentType};base64,${bytes}`} alt={titleFor(item)} /></div>
  }
  if (contentType === 'application/pdf' && bytes) {
    return <div className="preview-content"><iframe className="in-app-preview-frame" title={titleFor(item)} src={`data:application/pdf;base64,${bytes}`} /></div>
  }
  if (contentType.includes('wordprocessingml') && bytes) {
    return <div className="preview-content document-preview">{docLoading ? <div className="loading"><RefreshCw className="spin" /> Preparing document preview...</div> : docHtml ? <div dangerouslySetInnerHTML={{ __html: docHtml }} /> : <p>Could not render this DOCX file. The document content was not returned in a readable format.</p>}</div>
  }
  if (content) return <div className="preview-content">{typeof content === 'string' ? content : JSON.stringify(content, null, 2)}</div>
  return <div className="preview-content"><div className="preview-file-icon"><FileText size={28} /></div><strong>{titleFor(item)}</strong><p>This file is available in the connected workspace. An inline preview is not available for this file type.</p><div className="preview-metadata">{item.size ? `Size: ${item.size} bytes` : ''}{item.lastModifiedDateTime ? `Last modified: ${new Date(item.lastModifiedDateTime).toLocaleString()}` : ''}</div></div>
}

export default function Files() {
  const [source, setSource] = useState('sharepoint')
  const [siteId, setSiteId] = useState('')
  const [driveId, setDriveId] = useState('')
  const [folderId, setFolderId] = useState('')
  const [folderStack, setFolderStack] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [preview, setPreview] = useState(null)
  const [sharePointUrl, setSharePointUrl] = useState('')

  async function loadSharePoint(nextFolderId = folderId) {
    setLoading(true)
    try {
      const result = await getData('/sharepoint/files', {
        siteId: siteId.trim() || undefined,
        driveId: driveId.trim() || undefined,
        folderId: nextFolderId || undefined,
        limit: 100,
        orderBy: 'name asc',
      })
      setItems(itemsFrom(result, ['files', 'items', 'value']))
      setFolderId(nextFolderId)
    } catch (error) {
      toast.error(apiError(error))
    } finally { setLoading(false) }
  }

  async function loadOutlook() {
    setLoading(true)
    try {
      const result = await getData('/outlook/folders', { includeHidden: false, includeChildFolders: true, top: 100 })
      setItems(itemsFrom(result, ['folders', 'items', 'value']))
      setFolderStack([])
    } catch (error) { toast.error(apiError(error)) } finally { setLoading(false) }
  }

  useEffect(() => {
    if (source === 'sharepoint') loadSharePoint('')
    else loadOutlook()
  }, [source])

  async function openItem(item) {
    if (source === 'outlook' && Array.isArray(item.childFolders)) {
      setFolderStack(current => [...current, { id: item.id, name: titleFor(item) }])
      setItems(item.childFolders)
      return
    }
    if (source === 'sharepoint' && isFolder(item, source)) {
      const next = { id: item.id, name: titleFor(item), driveId: item.parentReference?.driveId || item.driveId || driveId }
      setFolderStack(current => [...current, next])
      setDriveId(next.driveId || '')
      await loadSharePoint(item.id)
      return
    }

    setSelected(item)
    if (source === 'sharepoint') {
      try {
        const result = await getData('/sharepoint/file', { fileId: item.id, driveId: item.parentReference?.driveId || item.driveId || driveId, downloadContent: true })
        setPreview({ ...item, ...(result || {}), ...(result?.file || {}) })
      } catch (error) { toast.error(apiError(error)) }
    } else {
      try {
        const result = await getData(`/outlook/folders/${encodeURIComponent(item.id)}/stats`, { includeSubfolders: true })
        setPreview({ ...item, ...result })
      } catch (error) { toast.error(apiError(error)); setPreview(item) }
    }
  }

  function goToFolder(index) {
    const nextStack = folderStack.slice(0, index)
    setFolderStack(nextStack)
    const next = nextStack.at(-1)
    setDriveId(next?.driveId || '')
    loadSharePoint(next?.id || '')
  }

  async function resolveLink(event) {
    event.preventDefault()
    if (!sharePointUrl.trim()) return
    try {
      const result = await getData('/sharepoint/resolve', { sharePointUrl: sharePointUrl.trim(), includePermissions: true })
      setSelected(result)
      setPreview(result)
      toast.success('SharePoint link resolved')
    } catch (error) { toast.error(apiError(error)) }
  }

  const refresh = () => source === 'sharepoint' ? loadSharePoint(folderId) : loadOutlook()

  return (
    <div className="page">
      <div className="page-heading">
        <div><div className="eyebrow"><OneDriveIcon size={14} /> Microsoft 365</div><h1>Files and folders</h1><p>Browse SharePoint, OneDrive, and Outlook folders from one place.</p></div>
        <button className="button button-light" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button>
      </div>

      <div className="tabs source-tabs">
        <button className={`tab ${source === 'sharepoint' ? 'active' : ''}`} onClick={() => setSource('sharepoint')}><OneDriveIcon size={14} /> SharePoint / OneDrive</button>
        <button className={`tab ${source === 'outlook' ? 'active' : ''}`} onClick={() => setSource('outlook')}><Mail size={14} /> Outlook folders</button>
      </div>

      {source === 'sharepoint' && <section className="panel files-controls"><form className="file-filter" onSubmit={event => { event.preventDefault(); setFolderStack([]); loadSharePoint('') }}><label><span>Site ID <small>(optional if backend has a default)</small></span><input value={siteId} onChange={event => setSiteId(event.target.value)} placeholder="Optional site ID" /></label><label><span>Drive ID <small>(optional)</small></span><input value={driveId} onChange={event => setDriveId(event.target.value)} placeholder="Optional drive ID" /></label><button className="button button-dark" type="submit"><Search size={15} /> Browse</button></form><form className="file-filter resolve-filter" onSubmit={resolveLink}><label><span>Resolve a SharePoint link</span><input value={sharePointUrl} onChange={event => setSharePointUrl(event.target.value)} placeholder="https://..." /></label><button className="button button-light" type="submit"><ExternalLink size={15} /> Resolve</button></form></section>}

      <div className="file-breadcrumbs"><button className="text-link" onClick={() => source === 'sharepoint' ? goToFolder(0) : loadOutlook()}>Root</button>{folderStack.map((folder, index) => <span key={folder.id}> <ChevronRight size={12} /> <button className="text-link" onClick={() => goToFolder(index + 1)}>{folder.name}</button></span>)}</div>

      <section className="panel table-panel">
        {loading ? <div className="loading"><RefreshCw className="spin" /> Loading folders...</div> : items.length ? items.map((item, index) => <button className="table-row file-row" key={item.id || index} onClick={() => openItem(item)}><span className="row-icon meetings">{isFolder(item, source) ? <FolderOpen size={17} /> : <FileText size={17} />}</span><span className="file-copy"><strong>{titleFor(item)}</strong><small>{isFolder(item, source) ? 'Folder' : item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime).toLocaleString() : item.webUrl || item.parentReference?.path || 'Open preview'}</small></span>{isFolder(item, source) ? <span className="pill">Folder</span> : <ChevronRight size={16} />}</button>) : <div className="empty"><div className="empty-icon"><FolderOpen size={24} /></div><h3>No folders or files found</h3><p>The connected account returned an empty folder.</p></div>}
      </section>

      {preview && <div className="preview-drawer"><div className="flyout-head"><strong>{titleFor(preview)}</strong><button className="icon-button" onClick={() => { setPreview(null); setSelected(null) }} aria-label="Close preview">×</button></div><PreviewContent item={preview} /></div>}
    </div>
  )
}
