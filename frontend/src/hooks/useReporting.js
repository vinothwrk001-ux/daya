import { useMemo, useState } from "react";
import { downloadReport } from "../services/reportingService";
import { buildDateRangeParams, defaultLast7Days } from "../utils/reporting";

function sameDate(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.getTime() === right.getTime();
}

export function useReporting({ module, getFilters, onApply, exporter, initialStartDate: initialStartDateProp, initialEndDate: initialEndDateProp, initialShift: initialShiftProp, initialStartTime: initialStartTimeProp, initialEndTime: initialEndTimeProp }) {
  const [defaultStartDate, defaultEndDate] = defaultLast7Days();
  const [draftDateRange, setDraftDateRange] = useState([initialStartDateProp || defaultStartDate, initialEndDateProp || defaultEndDate]);
  const [appliedDateRange, setAppliedDateRange] = useState([initialStartDateProp || defaultStartDate, initialEndDateProp || defaultEndDate]);
  
  const [draftTimeRange, setDraftTimeRange] = useState([initialStartTimeProp || "", initialEndTimeProp || ""]);
  const [appliedTimeRange, setAppliedTimeRange] = useState([initialStartTimeProp || "", initialEndTimeProp || ""]);

  const [shift, setShift] = useState(initialShiftProp || "all");
  const [appliedShift, setAppliedShift] = useState(initialShiftProp || "all");
  const [exportingFormat, setExportingFormat] = useState("");
  const [toast, setToast] = useState(null);

  const [startDate, endDate] = draftDateRange;
  const [appliedStartDate, appliedEndDate] = appliedDateRange;
  const [startTime, endTime] = draftTimeRange;
  const [appliedStartTime, appliedEndTime] = appliedTimeRange;

  const appliedParams = useMemo(
    () => ({
      ...buildDateRangeParams(appliedStartDate, appliedEndDate, appliedStartTime, appliedEndTime),
      ...(appliedShift && appliedShift !== "all" ? { shift: appliedShift } : {}),
    }),
    [appliedEndDate, appliedShift, appliedStartDate, appliedStartTime, appliedEndTime]
  );

  function applyDateRange() {
    setAppliedDateRange([startDate || null, endDate || null]);
    setAppliedTimeRange([startTime || "", endTime || ""]);
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
        startTime: appliedStartTime,
        endTime: appliedEndTime,
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
    startTime,
    endTime,
    setDateRange: setDraftDateRange,
    setTimeRange: setDraftTimeRange,
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
    hasPendingChanges: !sameDate(startDate, appliedStartDate) || !sameDate(endDate, appliedEndDate) || startTime !== appliedStartTime || endTime !== appliedEndTime || shift !== appliedShift,
  };
}
