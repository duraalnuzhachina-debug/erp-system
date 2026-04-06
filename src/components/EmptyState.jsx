import React from 'react';

/**
 * Empty State Component
 * Displays a friendly empty state with icon, message, and optional action
 */
const EmptyState = ({
  icon = null,
  title = '',
  message = '',
  action = null,
  secondaryAction = null,
  isRTL = false,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${isRTL ? 'rtl' : ''}`}>
      {icon ? (
        <div className="mb-4 grid h-20 w-20 place-items-center rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f5f8fc_100%)] text-slate-400 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">{icon}</div>
      ) : (
        <svg
          className="w-16 h-16 text-slate-300 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      )}

      <h3 className="text-lg font-black text-slate-800 mb-1 max-w-lg">{title}</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-md leading-6">{message}</p>

      {(action || secondaryAction) && (
        <div className="flex flex-col phone:flex-row items-center gap-2">
          {action && (
            <button
              onClick={action.onClick}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
