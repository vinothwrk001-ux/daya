let cartStateVersion = 0;

export function bumpCartStateVersion() {
  cartStateVersion += 1;
  return cartStateVersion;
}

export function getCartStateVersion() {
  return cartStateVersion;
}

export function isCurrentCartStateVersion(version) {
  return version === cartStateVersion;
}

export function resetCartStateVersion() {
  cartStateVersion = 0;
}
