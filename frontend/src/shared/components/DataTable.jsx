import { Fragment, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  Download,
  RefreshCw,
  Settings,
} from "lucide-react";

/**
 * Modern DataTable component with sorting, filtering, and actions
 * Provides a clean, accessible table with built-in loading and empty states
 */
export function DataTable({
  data,
  columns,
  isLoading = false,
  searchable = false,
  sortable = true,
  pagination = false,
  pageSize = 10,
  onRowClick,
  onSort,
  onSearch,
  className,
  emptyState,
  emptyText,
  getRowKey,
  expandedRowKey = null,
  renderExpandedRow,
  ...props
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);

  // Handle search
  const handleSearch = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
    onSearch?.(value);
  };

  // Handle sorting
  const handleSort = (columnKey) => {
    if (!sortable) return;

    let direction = "asc";
    if (sortConfig.key === columnKey && sortConfig.direction === "asc") {
      direction = "desc";
    }

    const newSortConfig = { key: columnKey, direction };
    setSortConfig(newSortConfig);
    onSort?.(newSortConfig);
  };

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data || [];

    // Apply search filter
    if (searchQuery && searchable) {
      filtered = filtered.filter((item) => {
        return columns.some((column) => {
          const value = item[column.accessor];
          return value
            ?.toString()
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        });
      });
    }

    // Apply sorting
    if (sortConfig.key && sortable) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchQuery, sortConfig, columns, searchable, sortable]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (!pagination) return processedData;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return processedData.slice(startIndex, endIndex);
  }, [processedData, currentPage, pageSize, pagination]);

  const totalPages = Math.ceil(processedData.length / pageSize);
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, processedData.length);

  // Get sort icon
  const getSortIcon = (columnKey) => {
    if (!sortable) return null;

    if (sortConfig.key !== columnKey) {
      return <ChevronsUpDown className="w-4 h-4 text-zinc-400" />;
    }

    return sortConfig.direction === "asc" ? (
      <ChevronUp className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
    ) : (
      <ChevronDown className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden",
          className,
        )}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-zinc-200 rounded animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-zinc-200 rounded animate-pulse" />
              <div className="h-8 w-8 bg-zinc-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                {columns.map((column) => (
                  <th key={column.accessor} className="px-4 py-3 text-left">
                    <div className="h-4 bg-zinc-200 rounded animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Empty state
  if (!processedData.length) {
    return (
      emptyState || (
        <div
          className={cn(
            "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center",
            className,
          )}
        >
          <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            {emptyText || "No data found"}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {searchQuery
              ? `No results match "${searchQuery}"`
              : "No records available"}
          </p>
        </div>
      )
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden",
        className,
      )}
      {...props}
    >
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-4">
            {searchable && (
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
              <Download className="w-4 h-4" />
            </button>
            <button className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.accessor || column.key}
                  className={cn(
                    "px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-700 dark:text-zinc-300 sm:px-4 sm:py-3 sm:text-xs",
                    column.headerClassName,
                    sortable &&
                      column.sortable !== false &&
                      "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
                  )}
                  onClick={() =>
                    sortable &&
                    column.sortable !== false &&
                    handleSort(column.accessor || column.key)
                  }
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {sortable &&
                      column.sortable !== false &&
                      getSortIcon(column.accessor || column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {paginatedData.map((row, rowIndex) => {
              const key = getRowKey ? getRowKey(row) : (row.id || row._id || rowIndex);
              const isExpanded = expandedRowKey != null && String(expandedRowKey) === String(key);
              return (
                <Fragment key={key}>
                  <tr
                    className={cn(
                      "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors",
                      onRowClick && "cursor-pointer",
                      isExpanded && "bg-zinc-50/60 dark:bg-zinc-800/50",
                    )}
                    onClick={(e) => {
                      const interactive = e.target?.closest?.("button,input,a,textarea,select,label");
                      if (interactive) return;
                      onRowClick?.(row);
                    }}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.accessor || column.key}
                    className={cn(
                      "min-w-0 px-3 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 sm:px-4 sm:py-3 sm:text-sm",
                      column.cellClassName,
                    )}
                      >
                        {column.render ? column.render(row) : (column.cell ? column.cell(row) : row[column.accessor || column.key])}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && typeof renderExpandedRow === "function" && (
                    <tr className="bg-zinc-50/40 dark:bg-zinc-800/50">
                      <td colSpan={columns.length} className="px-4 py-4">
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-xs text-zinc-700 dark:text-zinc-300 sm:text-sm">
              Showing {startRecord} to {endRecord} of {processedData.length}{" "}
              results
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs sm:text-sm border border-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "px-2.5 py-1 text-xs sm:text-sm border rounded-md transition-colors",
                        currentPage === pageNum
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs sm:text-sm border border-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Column configuration helper
 */
export function createColumn(accessor, header, options = {}) {
  return {
    accessor,
    header,
    sortable: true,
    ...options,
  };
}
