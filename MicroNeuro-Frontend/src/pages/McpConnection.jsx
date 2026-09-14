import { useState } from 'react'
import { Check, Copy, PlugZap } from 'lucide-react'
import { toast } from 'sonner'

const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const connectionUrl = `${apiOrigin}/api/v1/mcp`

export default function McpConnection() {
	const [copied, setCopied] = useState(false)

	async function copyUrl() {
		await navigator.clipboard.writeText(connectionUrl)
		setCopied(true)
		toast.success('MCP connection URL copied')
		window.setTimeout(() => setCopied(false), 1800)
	}

	return (
		<div className="page">
			<div className="page-heading">
				<div>
					<div className="eyebrow"><PlugZap size={14} /> Integrations</div>
					<h1>MCP connection</h1>
					<p>Connect an MCP-compatible client to your MicroNeuro workspace.</p>
				</div>
			</div>

			<section className="panel">
				<div className="panel-head">
					<div>
						<h2>Connection URL</h2>
						<p>Use this endpoint in your MCP client configuration.</p>
					</div>
					<Check size={18} color="var(--accent-green-text)" />
				</div>
				<div className="search" style={{ width: '100%' }}>
					<input value={connectionUrl} readOnly aria-label="MCP connection URL" />
					<button className="icon-button" onClick={copyUrl} title="Copy connection URL" aria-label="Copy connection URL">
						{copied ? <Check size={16} /> : <Copy size={16} />}
					</button>
				</div>
			</section>
		</div>
	)
}
