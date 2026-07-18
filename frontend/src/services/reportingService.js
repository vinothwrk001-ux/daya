import { api } from "./api";
import { buildDateRangeParams } from "../utils/reporting";

function getExtension(format) {
  if (format === "excel") return "xlsx";
  return format;
}

function getFilename(headers, module, format) {
  const disposition = headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  if (match?.[1]) return match[1];
  return `${module}.${getExtension(format)}`;
}

export async function downloadReport({ module, format, startDate, endDate, shift, filters = {} }) {
  const response = await api.get("/api/export", {
    params: {
      module,
      format,
      ...buildDateRangeParams(startDate, endDate),
      ...(shift ? { shift } : {}),
      filters: JSON.stringify(filters),
    },
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/octet-stream" });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = getFilename(response.headers, module, format);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
