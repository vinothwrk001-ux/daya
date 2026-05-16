export function getCartErrorMessage(error, fallback = "Something went wrong with your cart.") {
  const code = error?.response?.data?.code || error?.response?.data?.errorCode || "";
  const message = error?.response?.data?.message || error?.message || "";

  if (
    code === "OUT_OF_STOCK" ||
    code === "INSUFFICIENT_STOCK" ||
    code === "NOT_AVAILABLE" ||
    /insufficient stock/i.test(message) ||
    /out of stock/i.test(message) ||
    /not available/i.test(message)
  ) {
    return "This item is out of stock right now.";
  }

  return message || fallback;
}
