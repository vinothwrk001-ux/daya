const { body } = require("express-validator");

const updatePricingConfigSchema = [
  body("deliveryFee").optional().isFloat({ min: 0 }).withMessage("Delivery fee must be a non-negative number"),
  body("deliveryFreeAbove").optional().isFloat({ min: 0 }).withMessage("Delivery free above must be a non-negative number"),
  body("platformFeePercentage").optional().isFloat({ min: 0, max: 100 }).withMessage("Platform fee percentage must be between 0 and 100"),
  body("platformFeeCapped").optional().isFloat({ min: 0 }).withMessage("Platform fee capped must be a non-negative number"),
  body("taxPercentage").optional().isFloat({ min: 0, max: 100 }).withMessage("Tax percentage must be between 0 and 100"),
  body("taxableBasis").optional().isIn(["subtotal", "subtotalWithoutDiscount", "subtotalWithFees"]).withMessage("Invalid taxable basis"),
  body("handlingFee").optional().isFloat({ min: 0 }).withMessage("Handling fee must be a non-negative number"),
  body("bulkDiscountThreshold").optional().isInt({ min: 0 }).withMessage("Bulk discount threshold must be a non-negative integer"),
  body("bulkDiscountPercentage").optional().isFloat({ min: 0, max: 100 }).withMessage("Bulk discount percentage must be between 0 and 100"),
  body("maxDiscountPercentage").optional().isFloat({ min: 0, max: 100 }).withMessage("Max discount percentage must be between 0 and 100"),
  body("returnWindow").optional().isInt({ min: 0 }).withMessage("Return window must be a non-negative integer"),
  body("refundProcessingDays").optional().isInt({ min: 0 }).withMessage("Refund processing days must be a non-negative integer"),
  body("shippingModes.selfShipping").optional().isBoolean().withMessage("Self shipping must be a boolean"),
  body("shippingModes.platformShipping").optional().isBoolean().withMessage("Platform shipping must be a boolean"),
  body("notes").optional().isString().withMessage("Notes must be a string"),
];

module.exports = {
  updatePricingConfigSchema,
};
