import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

/**
 * A reusable Searchable Select component for HRMS.
 * 
 * @param {Object} props
 * @param {Array<{id: string, label: string, sublabel?: string}>} props.options
 * @param {string|string[]} props.value - Single ID or array of IDs (if multiple)
 * @param {Function} props.onChange
 * @param {string} props.placeholder
 * @param {boolean} props.multiple - Enable multi-select
 * @param {boolean} props.disabled
 */
export const SearchableSelect = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select option...", 
  multiple = false,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  const filteredOptions = options.filter(opt => 
    opt.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opt.sublabel?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOptions = multiple 
    ? options.filter(opt => (value || []).includes(opt.id))
    : options.find(opt => opt.id === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionId) => {
    if (multiple) {
      const newValue = (value || []).includes(optionId)
        ? (value || []).filter(id => id !== optionId)
        : [...(value || []), optionId];
      onChange(newValue);
    } else {
      onChange(optionId);
      setIsOpen(false);
    }
    setSearchTerm("");
  };

  const removeOption = (e, optionId) => {
    e.stopPropagation();
    if (multiple) {
      onChange((value || []).filter(id => id !== optionId));
    } else {
      onChange("");
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex min-h-[42px] w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white dark:bg-zinc-900 px-3 py-2 transition shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 ${disabled ? 'bg-zinc-50 dark:bg-zinc-800/50 cursor-not-allowed opacity-60' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}
      >
        <div className="flex flex-wrap gap-1 items-center flex-1">
          {multiple ? (
            (selectedOptions || []).length > 0 ? (
              (selectedOptions || []).map(opt => (
                <span key={opt.id} className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-100">
                  {opt.label}
                  <button onClick={(e) => removeOption(e, opt.id)} className="hover:text-indigo-900">
                    <X size={12} />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-sm text-zinc-400">{placeholder}</span>
            )
          ) : (
            selectedOptions ? (
              <span className="text-sm text-zinc-900 dark:text-zinc-100 font-medium">{selectedOptions.label}</span>
            ) : (
              <span className="text-sm text-zinc-400">{placeholder}</span>
            )
          )}
        </div>
        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="relative mb-1 p-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <input
              type="text"
              autoFocus
              className="w-full rounded-lg bg-zinc-50 dark:bg-zinc-800/50 py-2 pl-8 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-1 focus:ring-zinc-200 transition"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="max-h-[240px] overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => {
                const isSelected = multiple 
                  ? (value || []).includes(opt.id)
                  : value === opt.id;
                
                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelect(opt.id)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition ${isSelected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                  >
                    <div>
                      <p>{opt.label}</p>
                      {opt.sublabel && <p className={`text-[10px] ${isSelected ? 'text-indigo-500' : 'text-zinc-400'}`}>{opt.sublabel}</p>}
                    </div>
                    {isSelected && <CheckIcon />}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-zinc-400">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
