import { useEffect } from 'react';

export interface KanbanToast {
  id: number;
  text: string;
}

interface KanbanToastsProps {
  toasts: KanbanToast[];
  onDismiss: (id: number) => void;
  autoHideMs?: number;
}

export function KanbanToasts({ toasts, onDismiss, autoHideMs = 5000 }: KanbanToastsProps) {
  useEffect(() => {
    if (toasts.length === 0 || autoHideMs <= 0) return;
    const id = toasts[toasts.length - 1].id;
    const t = setTimeout(() => onDismiss(id), autoHideMs);
    return () => clearTimeout(t);
  }, [toasts, autoHideMs, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="position-fixed start-0 end-0 bottom-0 p-3 d-flex flex-column align-items-center gap-2"
      style={{ zIndex: 1050, pointerEvents: 'none' }}
    >
      <div className="d-flex flex-column gap-2 align-items-stretch" style={{ maxWidth: 420, width: '100%', pointerEvents: 'auto' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="alert alert-info shadow-sm py-2 px-3 mb-0 d-flex align-items-center justify-content-between"
            role="alert"
          >
            <span className="small">{t.text}</span>
            <button
              type="button"
              className="btn-close btn-close-sm"
              aria-label="Dismiss"
              onClick={() => onDismiss(t.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
