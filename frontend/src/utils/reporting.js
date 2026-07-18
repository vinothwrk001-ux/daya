export function toApiDate(value) {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDateRangeParams(startDate, endDate, startTime, endTime) {
  return {
    ...(startDate ? { startDate: toApiDate(startDate) } : {}),
    ...(endDate ? { endDate: toApiDate(endDate) } : {}),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  };
}

export function defaultLast7Days() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 6);
  return [startDate, endDate];
}
