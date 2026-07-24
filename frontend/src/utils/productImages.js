const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpg", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function createImageFingerprint(file) {
  return [file?.name, file?.size, file?.lastModified].filter(Boolean).join(":");
}

export function validateImageFiles(files = [], { remainingSlots = 10, existingImages = [] } = {}) {
  const nextFiles = [];
  const errors = [];
  const existingFingerprints = new Set(existingImages.map((image) => image.fileFingerprint).filter(Boolean));

  if (files.length > remainingSlots) {
    errors.push(`You can upload ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} in this section.`);
  }

  for (const file of Array.from(files).slice(0, remainingSlots)) {
    const fingerprint = createImageFingerprint(file);
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      errors.push(`${file.name}: unsupported format. Use PNG, JPG, JPEG, or WEBP.`);
      continue;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      errors.push(`${file.name}: file size exceeds 5 MB.`);
      continue;
    }
    if (existingFingerprints.has(fingerprint)) {
      errors.push(`${file.name}: duplicate image skipped.`);
      continue;
    }

    existingFingerprints.add(fingerprint);
    nextFiles.push(file);
  }

  return { acceptedFiles: nextFiles, errors };
}

export function syncManagedImages(images = [], { fallbackAlt = "" } = {}) {
  const filtered = (Array.isArray(images) ? images : []).filter((image) => image?.url);
  const primaryIndex = filtered.findIndex((image) => image.isPrimary);
  const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

  return filtered.map((image, index) => ({
    ...image,
    altText: String(image.altText || fallbackAlt || "").trim(),
    isPrimary: index === resolvedPrimaryIndex,
    sortOrder: index,
  }));
}

export function hydrateManagedImages(images = [], { fallbackAlt = "", idPrefix = "image" } = {}) {
  return syncManagedImages(
    (Array.isArray(images) ? images : []).map((image, index) => ({
      id: image.id || `${idPrefix}-${index}-${String(image.url || "").slice(-16)}`,
      url: image.url,
      altText: image.altText || fallbackAlt,
      isPrimary: Boolean(image.isPrimary),
      sortOrder: Number.isFinite(Number(image.sortOrder)) ? Number(image.sortOrder) : index,
      status: image.status || "uploaded",
      uploadProgress: Number.isFinite(Number(image.uploadProgress)) ? Number(image.uploadProgress) : 100,
      fileFingerprint: image.fileFingerprint || "",
      error: image.error || "",
    })),
    { fallbackAlt }
  );
}

export function buildImagePayload(images = [], fallbackAlt = "") {
  return syncManagedImages(images, { fallbackAlt }).map((image) => ({
    url: image.url,
    altText: image.altText || fallbackAlt,
    isPrimary: Boolean(image.isPrimary),
    sortOrder: Number.isFinite(Number(image.sortOrder)) ? Number(image.sortOrder) : 0,
  }));
}
