export default function EmptyPage({ title, description }) {
  return <div className="empty-page"><div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div></div><div className="empty-state"><div className="empty-icon">○</div><h2>{title} is ready</h2><p>The detailed {title.toLowerCase()} experience will be added here.</p></div></div>;
}
