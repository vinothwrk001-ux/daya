export function getCartErrorMessage(error, fallback = "Something went wrong with your cart.") {
  const code = error?.response?.data?.code || error?.response?.data?.errorCode || "";
  const message = error?.response?.data?.message || error?.message || "";
  const details = error?.response?.data?.details || {};
  const available = Number(details?.available);
  const variantTitle = String(details?.variantTitle || "").trim();

  if (code === "OUT_OF_STOCK" || /out of stock/i.test(message)) {
    if (variantTitle) return `${variantTitle} variant is out of stock`;
    return "This variant is out of stock";
  }

  if (code === "INSUFFICIENT_STOCK" || /only \d+ left/i.test(message) || /insufficient stock/i.test(message)) {
    if (message) return message;
    if (Number.isFinite(available) && available > 0) {
      return available === 1 ? "Only 1 left" : `Only ${available} left`;
    }
    return "Only limited stock is available";
  }

  if (code === "NOT_AVAILABLE" || /not available/i.test(message) || /variant unavailable/i.test(message)) {
    return "This variant is unavailable right now";
  }

  return message || fallback;
}

export function getCartMergeWarning(mergeResult) {
  if (!mergeResult?.adjusted && !(mergeResult?.conflicts || []).length) return "";
  if ((mergeResult?.conflicts || []).some((item) => /adjusted due to stock/i.test(item?.reason || ""))) {
    return "Some quantities were adjusted due to stock availability";
  }
  return mergeResult?.conflicts?.[0]?.reason || "Some cart items were adjusted during merge";
}
