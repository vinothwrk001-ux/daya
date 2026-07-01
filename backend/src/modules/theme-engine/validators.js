const DANGEROUS_PATTERNS = [
  /javascript\s*:/i,
  /expression\s*\(/i,
  /@import/i,
  /url\s*\(\s*["']?\s*data:/i,
  /<script/i,
  /behavior\s*:/i,
  /-moz-binding/i,
  /\\000/i,
];

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/;
const HSL_COLOR = /^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+\s*)?\)$/;
const SAFE_CSS_VALUE =
  /^[\w\s#%.,\-+*/()'"!]+$|^linear-gradient\([\w\s#%.,\-+*/()'"!]+\)$/i;

function isSafeColor(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (HEX_COLOR.test(trimmed)) return true;
  if (RGB_COLOR.test(trimmed)) return true;
  if (HSL_COLOR.test(trimmed)) return true;
  if (/^rgba?\(/i.test(trimmed) && !DANGEROUS_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (/^hsla?\(/i.test(trimmed) && !DANGEROUS_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (/^linear-gradient\(/i.test(trimmed) && !DANGEROUS_PATTERNS.some((p) => p.test(trimmed))) {
    return SAFE_CSS_VALUE.test(trimmed);
  }
  return false;
}

function isSafeCSSValue(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 512) return false;
  if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(trimmed))) return false;
  if (/url\s*\(/i.test(trimmed)) return false;
  return SAFE_CSS_VALUE.test(trimmed);
}

function sanitizeTokenObject(obj, { colorKeys = new Set(), cssKeys = new Set() } = {}) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeTokenObject(value, { colorKeys, cssKeys });
      continue;
    }
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (colorKeys.has(key) || key.toLowerCase().includes("color")) {
      if (isSafeColor(trimmed)) result[key] = trimmed;
      continue;
    }
    if (cssKeys.has(key) || isSafeCSSValue(trimmed)) {
      result[key] = trimmed.slice(0, 512);
    }
  }
  return result;
}

function sanitizeThemeLayer(layer = {}) {
  return sanitizeTokenObject(layer, {
    colorKeys: new Set([
      "primary",
      "secondary",
      "accent",
      "background",
      "surface",
      "card",
      "border",
      "textPrimary",
      "textSecondary",
      "success",
      "warning",
      "danger",
      "info",
      "priceColor",
      "discountBadge",
      "overlay",
    ]),
    cssKeys: new Set([
      "fontFamily",
      "headingFont",
      "bodyFont",
      "buttonFont",
      "containerWidth",
      "sectionPadding",
      "cardPadding",
      "buttonPadding",
      "inputPadding",
      "gridSpacing",
      "card",
      "button",
      "input",
      "modal",
      "drawer",
      "container",
      "transitionSpeed",
      "hoverDuration",
      "pageAnimation",
      "cardAnimation",
      "buttonAnimation",
      "modalAnimation",
      "reelsAnimation",
    ]),
  });
}

function sanitizeThemeMap(map = {}, validKeys = null) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  const result = {};
  for (const [key, value] of Object.entries(map)) {
    if (validKeys && !validKeys.has(key)) continue;
    if (!value || typeof value !== "object") continue;
    result[key] = sanitizeThemeLayer(value);
  }
  return result;
}

module.exports = {
  isSafeColor,
  isSafeCSSValue,
  sanitizeThemeLayer,
  sanitizeThemeMap,
  sanitizeTokenObject,
};
