const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { PRIVATE_UPLOAD_DIR } = require("../utils/upload");
const PrivateDocument = require("../models/PrivateDocument");
const DocumentAccessLog = require("../models/DocumentAccessLog");
const { actor: policyActor, requireAccess } = require("../security/authorizationPolicies");

function actorFromRequest(req = {}) {
  if (req.staff) {
    return policyActor({
      id: String(req.staff._id || req.user?.sub || ""),
      role: "staff",
      authType: "staff",
      permissions: req.staff.permissions || req.user?.permissions || {},
    });
  }
  if (req.user) {
    return policyActor({
      id: String(req.user.sub || req.user._id || ""),
      role: req.user.role,
      roles: Array.from(new Set([req.user.role, ...(req.user.roles || [])].filter(Boolean))),
      authType: req.user.authType || "user",
    });
  }
  return policyActor({ role: "anonymous", authType: "anonymous" });
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function assertDocumentAccess(actor, document) {
  if (!actor.id) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  if (!document || document.deletedAt) throw new AppError("Access denied", 403, "PRIVATE_DOCUMENT_ACCESS_DENIED");
  try {
    requireAccess(actor, "document", "download", document, "Access denied");
  } catch {
    throw new AppError("Access denied", 403, "PRIVATE_DOCUMENT_ACCESS_DENIED");
  }
}

function resolveStoragePath(storageKey = "") {
  const raw = String(storageKey || "");
  if (!raw || raw.split(/[\\/]+/).includes("..") || path.isAbsolute(raw)) {
    throw new AppError("Private document storage key is invalid", 500, "PRIVATE_DOCUMENT_STORAGE_INVALID");
  }
  const normalized = path.normalize(raw);
  if (!normalized || normalized === "." || path.isAbsolute(normalized)) {
    throw new AppError("Private document storage key is invalid", 500, "PRIVATE_DOCUMENT_STORAGE_INVALID");
  }
  const absolutePath = path.resolve(PRIVATE_UPLOAD_DIR, normalized);
  const privateRoot = path.resolve(PRIVATE_UPLOAD_DIR);
  if (absolutePath !== privateRoot && !absolutePath.startsWith(`${privateRoot}${path.sep}`)) {
    throw new AppError("Private document storage key is invalid", 500, "PRIVATE_DOCUMENT_STORAGE_INVALID");
  }
  return absolutePath;
}

async function auditAccess({ deps, document, actor, action, outcome, reason, req }) {
  await deps.DocumentAccessLog.create({
    documentId: document?._id,
    documentType: document?.documentType || "",
    ownerType: document?.ownerType || "",
    ownerId: document?.ownerId,
    requesterId: actor?.id || "",
    requesterRole: actor?.role || "",
    action,
    outcome,
    reason,
    ipAddress: req?.ip || "",
    userAgent: req?.get?.("user-agent") || "",
    metadata: { path: req?.originalUrl || "" },
  }).catch(() => {});
}

function defaultDeps() {
  return { PrivateDocument, DocumentAccessLog, fs };
}

async function getAuthorizedDocumentAccess(documentId, req = {}, deps = defaultDeps()) {
  const actor = actorFromRequest(req);
  let document = null;

  try {
    if (!isObjectId(documentId)) {
      throw new AppError("Access denied", 403, "PRIVATE_DOCUMENT_ACCESS_DENIED");
    }

    document = await deps.PrivateDocument.findById(documentId).lean();
    assertDocumentAccess(actor, document);

    const absolutePath = resolveStoragePath(document.storageKey);
    await deps.fs.promises.access(absolutePath, fs.constants.R_OK);
    await auditAccess({ deps, document, actor, action: "DOWNLOAD", outcome: "ALLOWED", req });

    return {
      document,
      absolutePath,
      filename: document.originalName || `${document.documentType || "document"}`,
      mimeType: document.mimeType || "application/octet-stream",
    };
  } catch (error) {
    await auditAccess({
      deps,
      document,
      actor,
      action: "FAILED_ACCESS",
      outcome: "DENIED",
      reason: error.code || error.message,
      req,
    });
    if (error instanceof AppError) throw error;
    throw new AppError("Access denied", 403, "PRIVATE_DOCUMENT_ACCESS_DENIED");
  }
}

module.exports = {
  actorFromRequest,
  assertDocumentAccess,
  resolveStoragePath,
  getAuthorizedDocumentAccess,
};
