const mongoose = require("mongoose");

const GUEST_ACTOR_TYPES = new Set(["guest"]);

function resolveRawActorId(actor) {
  if (!actor || typeof actor !== "object") return null;
  const candidate = actor.sub ?? actor._id ?? actor.userId ?? actor.id ?? null;
  if (candidate == null || candidate === "") return null;
  return candidate;
}

function isValidObjectId(value) {
  if (value == null || value === "") return false;
  const normalized = String(value).trim();
  if (!normalized || normalized === "guest" || normalized === "system") return false;
  return mongoose.isValidObjectId(normalized);
}

function normalizeAuditActor(actor = null, { guestSessionId = null } = {}) {
  const rawActorId = resolveRawActorId(actor);
  const explicitGuest =
    actor?.actorType === "guest" ||
    GUEST_ACTOR_TYPES.has(String(actor?.role || "").toLowerCase()) ||
    (rawActorId != null && String(rawActorId).trim() === "guest");

  if (!explicitGuest && isValidObjectId(rawActorId)) {
    return {
      actorType: actor?.actorType === "staff" ? "staff" : "customer",
      actorId: rawActorId,
      actorRole: actor?.role || "customer",
      guestSessionId: null,
    };
  }

  const resolvedGuestSessionId =
    guestSessionId || actor?.guestSessionId || actor?.guestToken || null;

  return {
    actorType: "guest",
    actorId: null,
    actorRole: "guest",
    guestSessionId: resolvedGuestSessionId ? String(resolvedGuestSessionId) : null,
  };
}

module.exports = {
  normalizeAuditActor,
  isValidObjectId,
};
