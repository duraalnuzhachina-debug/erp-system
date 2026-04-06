import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Enhanced Data Table Component with Sorting & Pagination
 * Supports:
 * - Column headers with sort indicators (▲▼)
 * - Pagination with customizable page size
 * - Empty state handling
 * - Loading state with skeletons
 * - Responsive design (table on desktop, cards on mobile)
 * - RTL/LTR support
 */
const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  pageSize = 10,
  onRowClick = null,
  emptyMessage = '',
  highlightRows = {},
  isRTL = false,
  renderRow = null,
  rowCountLabel = null,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key || !data.length) return data;

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bVal == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    return sorted;
  }, [data, sortConfig]);

  // Paginate
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="erp-data-grid space-y-3 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-slate-200/80 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // Empty state
  if (!data.length) {
    return (
      <div className="erp-data-grid flex flex-col items-center justify-center py-12 px-4">
        <div className="text-slate-400 mb-3">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-sm text-slate-500 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  // Desktop table
  return (
    <div className="space-y-4">
      {/* Desktop table (laptop+) */}
      <div className="hidden laptop:block overflow-x-auto erp-data-grid">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] border-b border-slate-200/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 cursor-pointer hover:bg-slate-100/70 transition-colors ${
                    isRTL ? 'text-right' : 'text-left'
                  }`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-2 justify-between">
                    <span>{col.label}</span>
                    {col.sortable !== false && (
                      <span className="text-slate-300">
                        {sortConfig.key === col.key ? (
                          sortConfig.direction === 'asc' ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )
                        ) : (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 5v14M12 5l4-4m-4 4l-4-4" strokeWidth={2} stroke="currentColor" fill="none" />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => {
              const rowId = row.id || idx;
              const highlight = highlightRows[rowId];
              const baseClass = `border-t border-slate-100/90 transition-colors cursor-pointer hover:bg-slate-50/70 ${
                highlight?.className || ''
              }`;

              return (
                <tr
                  key={rowId}
                  className={baseClass}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5 text-slate-700">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card view (phone + tablet) */}
      <div className="laptop:hidden space-y-3 px-1">
        {paginatedData.map((row, idx) => {
          const rowId = row.id || idx;
          const highlight = highlightRows[rowId];

          if (renderRow) {
            return (
              <div
                key={rowId}
                className={`rounded-xl border border-slate-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05)] overflow-hidden transition-colors ${
                  highlight?.className || ''
                } ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {renderRow(row)}
              </div>
            );
          }

          return (
            <div
              key={rowId}
              className={`rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-colors ${
                highlight?.className || ''
              } ${onRowClick ? 'cursor-pointer active:bg-slate-50' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <div key={col.key} className="flex justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{col.label}</span>
                  <span className="text-xs phone:text-sm font-semibold text-slate-900 text-right">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="erp-toolbar flex items-center justify-between px-2.5 py-2.5 rounded-xl">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          <span className="erp-subtle-chip">
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRTL ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      )}

      {/* Row count info */}
      {rowCountLabel && (
        <p className="text-xs text-slate-500 px-2 font-medium">
          {rowCountLabel(sortedData.length)}
        </p>
      )}
    </div>
  );
};

export default DataTable;
