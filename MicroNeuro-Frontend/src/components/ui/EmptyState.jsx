export default function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="empty">
      <div className="empty-icon">{Icon && <Icon size={22} />}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && onAction && (
        <button className="button button-light" style={{ marginTop: 14 }} onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}