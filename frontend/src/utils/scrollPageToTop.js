/**
 * Scroll the window to the top instantly, bypassing global `scroll-behavior: smooth`.
 */
export function scrollPageToTop() {
  if (typeof window === "undefined") return;

  const html = document.documentElement;
  const body = document.body;
  const prevHtmlBehavior = html.style.scrollBehavior;
  const prevBodyBehavior = body.style.scrollBehavior;

  html.style.scrollBehavior = "auto";
  body.style.scrollBehavior = "auto";

  html.scrollTop = 0;
  body.scrollTop = 0;

  try {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  } catch {
    window.scrollTo(0, 0);
  }

  html.style.scrollBehavior = prevHtmlBehavior;
  body.style.scrollBehavior = prevBodyBehavior;
}

/**
 * Scroll to a hash target if it exists in the document.
 * @returns {boolean} Whether an element was found and scrolled to
 */
export function scrollToHash(hash) {
  const id = hash.replace(/^#/, "");
  if (!id) return false;

  const element = document.getElementById(id);
  if (!element) return false;

  const html = document.documentElement;
  const body = document.body;
  const prevHtmlBehavior = html.style.scrollBehavior;
  const prevBodyBehavior = body.style.scrollBehavior;

  html.style.scrollBehavior = "auto";
  body.style.scrollBehavior = "auto";
  element.scrollIntoView({ block: "start", behavior: "auto" });

  html.style.scrollBehavior = prevHtmlBehavior;
  body.style.scrollBehavior = prevBodyBehavior;
  return true;
}

const PRODUCT_PATH = /^\/product\/[^/?#]+/;

export function isProductPath(path) {
  return PRODUCT_PATH.test(path);
}

function shouldHandleProductNavigation(event, href) {
  if (!href || !isProductPath(href)) return false;
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (anchor instanceof HTMLAnchorElement && anchor.target && anchor.target !== "_self") {
    return false;
  }

  return true;
}

function handleEarlyProductNavigation(event) {
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return;

  const href = anchor.getAttribute("href") || "";
  if (!shouldHandleProductNavigation(event, href)) return;

  scrollPageToTop();
}

/**
 * Register capture-phase handlers as early as possible so scroll resets
 * before React Router commits the next route.
 */
export function installEarlyScrollHandlers() {
  if (typeof document === "undefined") return;

  document.addEventListener("pointerdown", handleEarlyProductNavigation, { capture: true, passive: true });
  document.addEventListener("click", handleEarlyProductNavigation, { capture: true, passive: true });
}

/**
 * Navigate to a product page after resetting scroll so the PDP never
 * paints at the previous page's scroll position.
 */
export function navigateToProduct(navigate, url, options) {
  scrollPageToTop();
  navigate(url, options);
}

export function isProductNavigationClick(event, href) {
  return shouldHandleProductNavigation(event, href);
}
