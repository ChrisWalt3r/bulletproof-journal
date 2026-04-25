export default function Modal({
  open,
  title,
  children,
  actions,
  onClose,
  width = '560px',
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: width }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            x
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {actions ? <div className="modal__footer">{actions}</div> : null}
      </div>
    </div>
  );
}
