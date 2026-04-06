import React from 'react';
import { X } from 'lucide-react';

/**
 * Filter Chips Component
 * Displays filters as removable chips with visual feedback
 * Supports:
 * - Chip selection/deselection
 * - RTL layout support
 * - Custom styling per chip
 * - Clear all button
 */
const FilterChips = ({
  filters = [],
  selectedFilters = [],
  onFilterToggle = () => {},
  onClearAll = () => {},
  isRTL = false,
  label = '',
  clearLabel = '',
}) => {
  if (!filters.length) return null;

  const hasSelected = selectedFilters.length > 0;

  return (
    <div className={`erp-toolbar flex flex-wrap items-center gap-2 p-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
      {label && (
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em] whitespace-nowrap px-1">
          {label}
        </span>
      )}

      <div className={`flex flex-wrap gap-2 flex-1 ${isRTL ? 'justify-end' : 'justify-start'}`}>
        {filters.map((filter) => {
          const isSelected = selectedFilters.includes(filter.id);
          const bgClass = isSelected 
            ? 'bg-[linear-gradient(135deg,#e9f1fb_0%,#dce8f6_100%)] border-[#bfd0e7] text-[#38557d] shadow-[0_6px_16px_rgba(77,110,157,0.12)]' 
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300';

          return (
            <button
              key={filter.id}
              onClick={() => onFilterToggle(filter.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full border transition-all cursor-pointer ${bgClass}`}
            >
              {filter.icon && <span className="text-sm opacity-80">{filter.icon}</span>}
              <span>{filter.label}</span>
              {isSelected && (
                <X size={14} className="opacity-60 hover:opacity-100" />
              )}
            </button>
          );
        })}
      </div>

      {hasSelected && (
        <button
          onClick={onClearAll}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-full hover:bg-white transition-colors whitespace-nowrap border border-transparent hover:border-slate-200"
        >
          {clearLabel}
        </button>
      )}
    </div>
  );
};

export default FilterChips;
