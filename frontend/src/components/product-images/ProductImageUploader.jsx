import { useEffect, useRef, useState } from "react";
import { confirmAction } from "../../services/notificationService";
import { ImagePreviewGrid } from "./ImagePreviewGrid";
import { ImageUploadZone } from "./ImageUploadZone";
import { createImageFingerprint, hydrateManagedImages, syncManagedImages, validateImageFiles } from "../../utils/productImages";

function reorderImages(images, fromIndex, toIndex) {
  if (fromIndex === null || toIndex === null || fromIndex === toIndex) return images;
  const nextImages = [...images];
  const [moved] = nextImages.splice(fromIndex, 1);
  nextImages.splice(toIndex, 0, moved);
  return syncManagedImages(nextImages);
}

export function ProductImageUploader({
  title = "Product Images",
  description = "Upload a premium gallery for this product. The first image becomes the storefront primary image.",
  helperText = "PNG, JPG, JPEG, WEBP up to 5 MB each. Maximum 10 images.",
  images = [],
  onChange,
  uploadImages,
  productName = "",
  compact = false,
  maxImages = 10,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);

  const managedImages = hydrateManagedImages(images, { fallbackAlt: productName || "Product image", idPrefix: "product-image" });
  const latestImagesRef = useRef(managedImages);
  const remainingSlots = Math.max(0, maxImages - managedImages.length);

  useEffect(() => {
    latestImagesRef.current = managedImages;
  }, [managedImages]);

  function getLatestImages() {
    return latestImagesRef.current || [];
  }

  function mergePendingBatch(temporaryImages, nextUploadedImages = [], { fallbackAlt = productName } = {}) {
    const temporaryIds = new Set(temporaryImages.map((image) => image.id));
    const persistedImages = getLatestImages().filter((image) => !temporaryIds.has(image.id));
    return syncManagedImages([...persistedImages, ...nextUploadedImages], { fallbackAlt });
  }

  async function handleFilesSelected(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || !uploadImages) return;

    const { acceptedFiles, errors } = validateImageFiles(files, {
      remainingSlots,
      existingImages: managedImages,
    });
    setMessages(errors);

    if (!acceptedFiles.length) return;

    const batchId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const baseImages = getLatestImages();
    const temporaryImages = acceptedFiles.map((file, index) => ({
      id: `${batchId}-${index}`,
      url: URL.createObjectURL(file),
      altText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim(),
      isPrimary: false,
      sortOrder: baseImages.length + index,
      status: "uploading",
      uploadProgress: 0,
      fileFingerprint: createImageFingerprint(file),
      error: "",
    }));

    onChange?.(syncManagedImages([...baseImages, ...temporaryImages], { fallbackAlt: productName }));
    setIsUploading(true);

    try {
      const response = await uploadImages(
        acceptedFiles,
        { context: compact ? "variant" : "product", productName },
        (progressEvent) => {
          const percent = progressEvent?.total ? Math.round((progressEvent.loaded / progressEvent.total) * 100) : 0;
          const temporaryIds = new Set(temporaryImages.map((image) => image.id));
          const withProgress = getLatestImages().map((image) =>
            temporaryIds.has(image.id) ? { ...image, uploadProgress: percent } : image
          );
          onChange?.(syncManagedImages(withProgress, { fallbackAlt: productName }));
        }
      );

      const uploadedImages = Array.isArray(response?.data) ? response.data : [];
      const hydratedUploads = uploadedImages.map((image, index) => ({
        id: `uploaded-${Date.now()}-${index}`,
        url: image.url,
        altText: image.altText || temporaryImages[index]?.altText || productName || "Product image",
        isPrimary: false,
        sortOrder: baseImages.length + index,
        status: "uploaded",
        uploadProgress: 100,
        fileFingerprint: temporaryImages[index]?.fileFingerprint || "",
        error: "",
      }));

      temporaryImages.forEach((image) => {
        if (image.url?.startsWith("blob:")) {
          URL.revokeObjectURL(image.url);
        }
      });

      onChange?.(mergePendingBatch(temporaryImages, hydratedUploads));
    } catch (error) {
      temporaryImages.forEach((image) => {
        if (image.url?.startsWith("blob:")) {
          URL.revokeObjectURL(image.url);
        }
      });
      onChange?.(mergePendingBatch(temporaryImages, []));
      setMessages((current) => [
        ...current,
        error?.response?.data?.message || error?.message || "Upload failed. Please try again.",
      ]);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemove(index) {
    const target = managedImages[index];
    if (target?.isPrimary) {
      const confirmed = await confirmAction({ message: "This is the primary image. Remove it and promote the next image automatically?", tone: "danger", confirmLabel: "Confirm" });
      if (!confirmed) return;
    }

    if (target?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(target.url);
    }

    onChange?.(syncManagedImages(managedImages.filter((_, imageIndex) => imageIndex !== index), { fallbackAlt: productName }));
  }

  function handleSetPrimary(index) {
    onChange?.(syncManagedImages(managedImages.map((image, imageIndex) => ({ ...image, isPrimary: imageIndex === index })), { fallbackAlt: productName }));
  }

  function handleAltTextChange(index, value) {
    onChange?.(syncManagedImages(managedImages.map((image, imageIndex) => (imageIndex === index ? { ...image, altText: value } : image)), { fallbackAlt: productName }));
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <ImageUploadZone
        title={title}
        description={description}
        helperText={`${helperText} ${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} remaining.`}
        onFilesSelected={handleFilesSelected}
        disabled={remainingSlots === 0}
        compact={compact}
        isUploading={isUploading}
      />

      {messages.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200">
          {messages.map((message, index) => (
            <p key={`${message}-${index}`}>{message}</p>
          ))}
        </div>
      ) : null}

      <ImagePreviewGrid
        images={managedImages}
        dragIndex={dragIndex}
        compact={compact}
        onDragStart={(index) => setDragIndex(index)}
        onDragOver={(event, index) => {
          event.preventDefault();
          if (dragIndex === null || dragIndex === index) return;
          const reordered = reorderImages(managedImages, dragIndex, index);
          setDragIndex(index);
          onChange?.(reordered);
        }}
        onDragEnd={() => setDragIndex(null)}
        onRemove={handleRemove}
        onSetPrimary={handleSetPrimary}
        onAltTextChange={handleAltTextChange}
      />
    </div>
  );
}
