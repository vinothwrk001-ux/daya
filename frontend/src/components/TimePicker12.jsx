import { useMemo } from "react";

export function TimePicker12({ value, onChange, disabled }) {
  const { h, m, ampm } = useMemo(() => {
    if (!value) return { h: "12", m: "00", ampm: "AM" };
    const [hours, mins] = value.split(":");
    let hr = parseInt(hours, 10);
    const period = hr >= 12 ? "PM" : "AM";
    hr = hr % 12 || 12;
    return { h: String(hr).padStart(2, "0"), m: String(mins || "00").padStart(2, "0"), ampm: period };
  }, [value]);

  function handleChange(type, newVal) {
    let newH = parseInt(h, 10);
    let newM = parseInt(m, 10);
    let newAmpm = ampm;

    if (type === "h") newH = parseInt(newVal, 10);
    if (type === "m") newM = parseInt(newVal, 10);
    if (type === "ampm") newAmpm = newVal;

    let outH = newH;
    if (newAmpm === "PM" && outH < 12) outH += 12;
    if (newAmpm === "AM" && outH === 12) outH = 0;

    const formattedH = String(outH).padStart(2, "0");
    const formattedM = String(newM).padStart(2, "0");
    onChange?.(`${formattedH}:${formattedM}`);
  }

  return (
    <div className="flex h-12 items-center rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950">
      <select
        value={h}
        onChange={(e) => handleChange("h", e.target.value)}
        disabled={disabled}
        className="appearance-none bg-transparent px-1 text-center text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed dark:text-white"
        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
      >
        {Array.from({ length: 12 }).map((_, i) => {
          const val = String(i + 1).padStart(2, "0");
          return <option key={val} value={val}>{val}</option>;
        })}
      </select>
      <span className="text-slate-400">:</span>
      <select
        value={m}
        onChange={(e) => handleChange("m", e.target.value)}
        disabled={disabled}
        className="appearance-none bg-transparent px-1 text-center text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed dark:text-white"
        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
      >
        {Array.from({ length: 60 }).map((_, i) => {
          const val = String(i).padStart(2, "0");
          return <option key={val} value={val}>{val}</option>;
        })}
      </select>
      <select
        value={ampm}
        onChange={(e) => handleChange("ampm", e.target.value)}
        disabled={disabled}
        className="appearance-none bg-transparent pl-1 pr-2 text-center text-sm font-bold text-slate-900 outline-none disabled:cursor-not-allowed dark:text-white"
        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
