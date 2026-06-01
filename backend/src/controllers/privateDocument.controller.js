const { asyncHandler } = require("../utils/asyncHandler");
const privateDocumentService = require("../services/privateDocument.service");

const accessPrivateDocument = asyncHandler(async (req, res) => {
  const access = await privateDocumentService.getAuthorizedDocumentAccess(req.params.documentId, req);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", access.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${String(access.filename).replace(/"/g, "")}"`);
  return res.sendFile(access.absolutePath);
});

module.exports = { accessPrivateDocument };
