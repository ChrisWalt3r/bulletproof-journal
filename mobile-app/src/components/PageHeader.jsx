export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  aside,
  compact = false,
  variant = 'default',
}) {
  return (
    <header
      className={[
        'page-header',
        `page-header--${variant}`,
        compact ? 'page-header--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="page-header__copy">
        {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {aside ? <div className="page-header__aside">{aside}</div> : null}
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
