import { Link } from 'react-router-dom'
import { ArrowLeft, Clock3 } from 'lucide-react'
import { ExcelIcon, PowerPointIcon, WordIcon } from '../components/BrandIcons'

const products = {
	excel: { name: 'Excel', Icon: ExcelIcon },
	word: { name: 'Word', Icon: WordIcon },
	powerpoint: { name: 'PowerPoint', Icon: PowerPointIcon },
}

export default function ComingSoon({ type }) {
	const product = products[type] || products.excel
	const { Icon } = product

	return (
		<div className="page">
			<div className="page-heading">
				<div>
					<div className="eyebrow"><Icon size={14} /> Microsoft 365</div>
					<h1>{product.name} integration</h1>
					<p>Bring {product.name} workflows into MicroNeuro when this integration is ready.</p>
				</div>
			</div>

			<section className="panel empty">
				<div className="empty-icon"><Clock3 size={24} /></div>
				<h3>Coming soon</h3>
				<p>This integration is on the roadmap.</p>
				<Link to="/" className="button button-light" style={{ marginTop: 14 }}>
					<ArrowLeft size={15} /> Back to dashboard
				</Link>
			</section>
		</div>
	)
}
