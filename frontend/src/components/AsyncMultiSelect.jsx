import { useEffect, useMemo, useRef, useState } from "react";

export function AsyncMultiSelect({
  value = [],
  onChange,
  loadOptions,
  placeholder = "Search and select...",
  disabled = false,
  maxItems,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      if (!loadOptions) return;
      try {
        setLoading(true);
        const result = await loadOptions(searchTerm);
        if (active) {
          setOptions(Array.isArray(result) ? result : []);
        }
      } catch {
        if (active) {
          setOptions([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadOptions, searchTerm]);

  const selectedMap = useMemo(() => {
    const map = new Map();
    for (const option of options) {
      map.set(String(option.value), option);
    }
    for (const item of value) {
      if (typeof item === "object" && item?.value) {
        map.set(String(item.value), item);
      }
    }
    return map;
  }, [options, value]);

  const selectedValues = value.map((item) => (typeof item === "object" ? String(item.value) : String(item)));
  const selectedItems = selectedValues.map((item) => selectedMap.get(item) || { value: item, label: item });

  const availableOptions = options.filter((option) => !selectedValues.includes(String(option.value)));

  function addItem(option) {
    if (disabled) return;
    if (maxItems && selectedValues.length >= maxItems) return;
    onChange([...(value || []), option.value]);
    setSearchTerm("");
  }

  function removeItem(optionValue) {
    onChange(selectedValues.filter((item) => item !== String(optionValue)));
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`min-h-12 rounded-2xl border px-4 py-2 ${
          disabled ? "border-slate-200 bg-slate-100 opacity-70 dark:border-slate-800 dark:bg-slate-900/40" : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {selectedItems.length ? (
            selectedItems.map((item) => (
              <span
                key={item.value}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {item.label}
                <button
                  type="button"
                  onClick={() => removeItem(item.value)}
                  className="text-slate-500 transition hover:text-slate-800 dark:hover:text-white"
                >
                  x
                </button>
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
        </div>

        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedItems.length ? "Search more..." : placeholder}
          disabled={disabled}
          className="mt-1 w-full border-0 bg-transparent px-0 py-1 text-sm outline-none dark:text-white"
        />
      </div>

      {isOpen ? (
        <div className="absolute top-full z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          ) : availableOptions.length ? (
            availableOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => addItem(option)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <span>{option.label}</span>
                {option.meta ? <span className="text-xs text-slate-400">{option.meta}</span> : null}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No matches found</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
