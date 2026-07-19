const { body } = require("express-validator");

const bulkUpdateRulesSchema = [
  body("ruleIds").isArray().withMessage("ruleIds array is required"),
  body("updates").isObject().withMessage("updates object is required"),
];

const calculatePreviewSchema = [
  body("weight").isNumeric().withMessage("Weight must be provided and greater than 0").custom(value => {
    if (value <= 0) throw new Error("Weight must be greater than 0");
    return true;
  })
];

module.exports = {
  bulkUpdateRulesSchema,
  calculatePreviewSchema
};
