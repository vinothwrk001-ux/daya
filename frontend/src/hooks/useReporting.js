import { useMemo, useState } from "react";
import { downloadReport } from "../services/reportingService";
import { buildDateRangeParams, defaultLast7Days } from "../utils/reporting";

function sameDate(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.getTime() === right.getTime();
}

export function useReporting({ module, getFilters, onApply, exporter, initialStartDate: initialStartDateProp, initialEndDate: initialEndDateProp, initialShift: initialShiftProp }) {
  const [defaultStartDate, defaultEndDate] = defaultLast7Days();
  const [draftDateRange, setDraftDateRange] = useState([initialStartDateProp || defaultStartDate, initialEndDateProp || defaultEndDate]);
  const [appliedDateRange, setAppliedDateRange] = useState([initialStartDateProp || defaultStartDate, initialEndDateProp || defaultEndDate]);
  const [shift, setShift] = useState(initialShiftProp || "all");
  const [appliedShift, setAppliedShift] = useState(initialShiftProp || "all");
  const [exportingFormat, setExportingFormat] = useState("");
  const [toast, setToast] = useState(null);

  const [startDate, endDate] = draftDateRange;
  const [appliedStartDate, appliedEndDate] = appliedDateRange;
  const appliedParams = useMemo(
    () => ({
      ...buildDateRangeParams(appliedStartDate, appliedEndDate),
      ...(appliedShift && appliedShift !== "all" ? { shift: appliedShift } : {}),
    }),
    [appliedEndDate, appliedShift, appliedStartDate]
  );

  function applyDateRange() {
    setAppliedDateRange([startDate || null, endDate || null]);
    setAppliedShift(shift);
    onApply?.([startDate || null, endDate || null]);
  }

  async function exportReport(format) {
    try {
      setExportingFormat(format);
      const exportFn = exporter || downloadReport;
      await exportFn({
        module,
        format,
        startDate: appliedStartDate,
        endDate: appliedEndDate,
        shift: appliedShift && appliedShift !== "all" ? appliedShift : undefined,
        filters: getFilters?.() || {},
      });
      setToast({
        type: "success",
        message: `${format.toUpperCase()} report downloaded successfully.`,
      });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Failed to export report.";
      setToast({ type: "error", message });
      throw error;
    } finally {
      setExportingFormat("");
    }
  }

  return {
    startDate,
    endDate,
    setDateRange: setDraftDateRange,
    applyDateRange,
    appliedStartDate,
    appliedEndDate,
    appliedParams,
    exportingFormat,
    exportReport,
    toast,
    clearToast: () => setToast(null),
    shift,
    setShift,
    appliedShift,
    hasPendingChanges: !sameDate(startDate, appliedStartDate) || !sameDate(endDate, appliedEndDate) || shift !== appliedShift,
  };
}
