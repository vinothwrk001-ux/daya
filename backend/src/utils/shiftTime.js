function normalizeShiftValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "day") return "day";
  if (normalized === "night") return "night";
  return "all";
}

function resolveShiftWindow(dateValue, shift) {
  const normalizedShift = normalizeShiftValue(shift);
  if (normalizedShift === "all") return null;

  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();
  const millis = date.getUTCMilliseconds();
  const timeValue = hour * 3600 * 1000 + minute * 60 * 1000 + second * 1000 + millis;

  if (normalizedShift === "day") {
    const start = 10 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000;
    const end = 22 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000 + 999;
    return timeValue >= start && timeValue <= end ? { start, end } : null;
  }

  const start = 23 * 3600 * 1000;
  const end = 10 * 3600 * 1000 + 59 * 60 * 1000 + 58 * 1000;
  return timeValue >= start || timeValue <= end ? { start, end } : null;
}

function matchesBusinessShift(dateValue, shift) {
  const normalizedShift = normalizeShiftValue(shift);
  if (normalizedShift === "all") return true;

  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();
  const millis = date.getUTCMilliseconds();
  const timeValue = hour * 3600 * 1000 + minute * 60 * 1000 + second * 1000 + millis;

  if (normalizedShift === "day") {
    return timeValue >= 10 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000 && timeValue <= 22 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000 + 999;
  }

  return timeValue >= 23 * 3600 * 1000 || timeValue <= 10 * 3600 * 1000 + 59 * 60 * 1000 + 58 * 1000;
}

function buildShiftDateRange({ startDate, endDate, shift }) {
  const normalizedShift = normalizeShiftValue(shift);
  if (normalizedShift === "all") return null;

  const baseStart = startDate ? new Date(startDate) : null;
  const baseEnd = endDate ? new Date(endDate) : null;
  if (!baseStart && !baseEnd) return null;

  if (normalizedShift === "day") {
    if (baseStart) {
      baseStart.setUTCHours(10, 59, 59, 0);
    }
    if (baseEnd) {
      baseEnd.setUTCHours(22, 59, 59, 999);
    }
    return { startDate: baseStart, endDate: baseEnd, shift: normalizedShift };
  }

  if (baseStart) {
    baseStart.setUTCHours(23, 0, 0, 0);
  }
  if (baseEnd) {
    baseEnd.setUTCHours(10, 59, 58, 0);
  }

  return { startDate: baseStart, endDate: baseEnd, shift: normalizedShift };
}

function buildShiftQueryRange({ startDate, endDate, shift }, baseRange = null) {
  const normalizedShift = normalizeShiftValue(shift);
  if (normalizedShift === "all") {
    return baseRange;
  }

  const shiftRange = buildShiftDateRange({ startDate, endDate, shift });
  if (!shiftRange) {
    return baseRange;
  }

  const range = {};
  const lowerBound = shiftRange.startDate || baseRange?.$gte || null;
  const upperBound = shiftRange.endDate || baseRange?.$lte || null;

  if (lowerBound) {
    range.$gte = baseRange?.$gte ? new Date(Math.max(baseRange.$gte.getTime(), lowerBound.getTime())) : lowerBound;
  } else if (baseRange?.$gte) {
    range.$gte = baseRange.$gte;
  }

  if (upperBound) {
    range.$lte = baseRange?.$lte ? new Date(Math.min(baseRange.$lte.getTime(), upperBound.getTime())) : upperBound;
  } else if (baseRange?.$lte) {
    range.$lte = baseRange.$lte;
  }

  return range;
}

module.exports = {
  normalizeShiftValue,
  resolveShiftWindow,
  matchesBusinessShift,
  buildShiftDateRange,
  buildShiftQueryRange,
};
