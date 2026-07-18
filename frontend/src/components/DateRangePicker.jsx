import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DateRange } from "react-date-range";
import { TimePicker12 } from "./TimePicker12";
import { addDays, endOfDay, isValid, parse, startOfDay } from "date-fns";

function normalizeRange(startDate, endDate) {
  return {
    startDate: startDate ? startOfDay(startDate) : startOfDay(addDays(new Date(), -6)),
    endDate: endDate ? endOfDay(endDate) : endOfDay(new Date()),
    key: "selection",
  };
}

function formatInputValue(value) {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputValue(value) {
  if (!value.trim()) return null;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  if (!isValid(parsed)) return undefined;
  return parsed;
}

export function DateRangePicker({
  startDate,
  endDate,
  startTime,
  endTime,
  onChange,
  onTimeChange,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeField, setActiveField] = useState("start");
  const [startInput, setStartInput] = useState(formatInputValue(startDate));
  const [endInput, setEndInput] = useState(formatInputValue(endDate));
  const [validationMessage, setValidationMessage] = useState("");
  const rootRef = useRef(null);
  const startInputId = useId();
  const endInputId = useId();

  const selection = useMemo(() => normalizeRange(startDate, endDate), [endDate, startDate]);

  useEffect(() => {
    setStartInput(formatInputValue(startDate));
  }, [startDate]);

  useEffect(() => {
    setEndInput(formatInputValue(endDate));
  }, [endDate]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function updateRange(nextStart, nextEnd) {
    onChange?.([nextStart ? startOfDay(nextStart) : null, nextEnd ? endOfDay(nextEnd) : null]);
  }

  function commitInputRange(nextStartInput, nextEndInput, preferredField = activeField) {
    const parsedStart = parseInputValue(nextStartInput);
    const parsedEnd = parseInputValue(nextEndInput);

    if (parsedStart === undefined || parsedEnd === undefined) {
      setValidationMessage("Use YYYY-MM-DD format.");
      return;
    }

    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
      setValidationMessage("End date cannot be earlier than start date.");
      if (preferredField === "end") {
        updateRange(parsedStart, parsedStart);
      } else {
        updateRange(parsedEnd, parsedEnd);
      }
      return;
    }

    setValidationMessage("");
    updateRange(parsedStart, parsedEnd);
  }

  function handleSelect(ranges) {
    const next = ranges.selection;
    setValidationMessage("");
    updateRange(next.startDate, next.endDate);
    if (activeField === "start") {
      setActiveField("end");
    }
  }

  function handleInputKeyDown(event, nextStartInput, nextEndInput, field) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitInputRange(nextStartInput, nextEndInput, field);
    }
  }

  function clearBoundary(boundary) {
    setValidationMessage("");

    if (boundary === "start") {
      setStartInput("");
      updateRange(null, endDate || null);
      return;
    }

    setEndInput("");
    updateRange(startDate || null, null);
  }

  return (
    <div ref={rootRef} className="relative w-full md:w-auto md:flex-none">
      <div className="flex w-full flex-col items-stretch gap-4 md:w-auto md:flex-row md:items-end md:gap-6">
        <label className="grid w-full gap-1 shrink-0 md:w-auto">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Start Date & Time</span>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="date-range-input-shell md:w-56">
              <span className="date-range-input-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18h-10.5A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V3a1 1 0 0 1 1-1Zm9.25 6h-10.5a.75.75 0 0 0-.75.75v6.5c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75v-6.5a.75.75 0 0 0-.75-.75Z" />
                </svg>
              </span>
            <input
              id={startInputId}
              type="text"
              inputMode="numeric"
              placeholder="Start date"
              value={startInput}
              disabled={disabled}
              onFocus={() => {
                setActiveField("start");
                setIsOpen(true);
              }}
              onClick={() => {
                setActiveField("start");
                setIsOpen(true);
              }}
              onChange={(event) => setStartInput(event.target.value)}
              onBlur={() => commitInputRange(startInput, endInput, "start")}
              onKeyDown={(event) => handleInputKeyDown(event, startInput, endInput, "start")}
              className="date-range-input"
              aria-label="Start date"
              aria-describedby={validationMessage ? `${startInputId}-error` : undefined}
            />
            {startInput ? (
              <button
                type="button"
                onClick={() => clearBoundary("start")}
                className="date-range-clear-button"
                aria-label="Clear start date"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path strokeLinecap="round" d="M5 5l10 10M15 5 5 15" />
                </svg>
              </button>
            ) : null}
            </div>
            <TimePicker12 value={startTime} onChange={(val) => onTimeChange?.([val, endTime || ""])} disabled={disabled} />
          </div>
        </label>

        <label className="grid w-full gap-1 shrink-0 md:w-auto">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">End Date & Time</span>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="date-range-input-shell md:w-56">
              <span className="date-range-input-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18h-10.5A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V3a1 1 0 0 1 1-1Zm9.25 6h-10.5a.75.75 0 0 0-.75.75v6.5c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75v-6.5a.75.75 0 0 0-.75-.75Z" />
              </svg>
            </span>
            <input
              id={endInputId}
              type="text"
              inputMode="numeric"
              placeholder="End date"
              value={endInput}
              disabled={disabled}
              onFocus={() => {
                setActiveField("end");
                setIsOpen(true);
              }}
              onClick={() => {
                setActiveField("end");
                setIsOpen(true);
              }}
              onChange={(event) => setEndInput(event.target.value)}
              onBlur={() => commitInputRange(startInput, endInput, "end")}
              onKeyDown={(event) => handleInputKeyDown(event, startInput, endInput, "end")}
              className="date-range-input"
              aria-label="End date"
              aria-describedby={validationMessage ? `${startInputId}-error` : undefined}
            />
            {endInput ? (
              <button
                type="button"
                onClick={() => clearBoundary("end")}
                className="date-range-clear-button"
                aria-label="Clear end date"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path strokeLinecap="round" d="M5 5l10 10M15 5 5 15" />
                </svg>
              </button>
            ) : null}
            </div>
            <TimePicker12 value={endTime} onChange={(val) => onTimeChange?.([startTime || "", val])} disabled={disabled} />
          </div>
        </label>
      </div>

      {validationMessage ? (
        <div
          id={`${startInputId}-error`}
          className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {validationMessage}
        </div>
      ) : null}

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={activeField === "end" ? endInputId : startInputId}
          className="absolute left-0 top-[calc(100%+0.75rem)] z-50 w-full max-w-[24rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950"
        >
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Select Date Range</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Choose a start date and end date for filters and exports.</div>
          </div>

          <div className="overflow-x-auto p-4">
            <DateRange
              onChange={handleSelect}
              moveRangeOnFirstSelection={false}
              months={1}
              ranges={[selection]}
              direction="horizontal"
              showDateDisplay={false}
              showMonthAndYearPickers
              editableDateInputs={false}
              retainEndDateOnFirstSelection
              rangeColors={["#6366f1"]}
              weekdayDisplayFormat="EEEEE"
              weekStartsOn={0}
              staticRanges={[]}
              inputRanges={[]}
              ariaLabels={{
                dateInput: {
                  selection: {
                    startDate: "Start date",
                    endDate: "End date",
                  },
                },
                monthPicker: "Month picker",
                yearPicker: "Year picker",
                prevButton: "Previous month",
                nextButton: "Next month",
              }}
              className="app-date-range-picker"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
