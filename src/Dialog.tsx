import { useEffect, useId, type ReactNode } from 'react';

// A dialog over the board. Escape, the ×, Done or a click outside closes it.
const Dialog = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md max-h-full overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start mb-3">
          <h2 id={titleId} className="text-lg font-bold mr-auto">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="px-2 text-xl leading-none text-slate-500 hover:text-slate-900">
            ×
          </button>
        </div>
        {children}
        <div className="mt-4 text-right">
          <button onClick={onClose} className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm">Done</button>
        </div>
      </div>
    </div>
  );
};

export default Dialog;
