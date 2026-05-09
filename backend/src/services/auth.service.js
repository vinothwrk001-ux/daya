const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const userRepo = require("../repositories/user.repository");
const sessionRepo = require("../repositories/session.repository");
const auditService = require("./audit.service");
const { isInfluencerCommerceEnabled } = require("./influencer-commerce-config.service");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl || null,
    preferences: user.preferences || {
      theme: "light",
      notificationPreferences: {
        orderUpdates: true,
        deliveryAlerts: true,
        paymentAlerts: true,
        promotions: false,
      },
    },
    createdAt: user.createdAt,
  };
}

function getRefreshExpiryDate() {
  const ttlDays = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
}

async function createSessionTokens(user, meta = {}) {
  const session = await sessionRepo.create({
    userId: user._id,
    refreshTokenHash: "pending",
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
    expiresAt: getRefreshExpiryDate(),
    lastUsedAt: new Date(),
  });

  const refreshToken = signRefreshToken({ user, sessionId: session._id });
  const accessToken = signAccessToken(user);

  await sessionRepo.updateById(session._id, {
    refreshTokenHash: hashToken(refreshToken),
    lastUsedAt: new Date(),
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: normalizeUser(user),
  };
}

async function assertInfluencerAccessAllowed(role) {
  if (role !== "influencer") return;
  const enabled = await isInfluencerCommerceEnabled();
  if (!enabled) {
    throw new AppError(
      "Influencer registrations are paused by the platform administrator.",
      403,
      "INFLUENCER_COMMERCE_DISABLED"
    );
  }
}

async function register({ name, email, phone, password, role }, meta = {}) {
  const normalizedEmail = email ? String(email).toLowerCase() : null;

  await assertInfluencerAccessAllowed(role);

  if (["vendor", "influencer"].includes(role) && !normalizedEmail) {
    throw new AppError("Email is required for vendors and influencers", 400, "VALIDATION_ERROR");
  }

  if (normalizedEmail) {
    const existing = await userRepo.findByEmail(normalizedEmail);
    if (existing) throw new AppError("Email already in use", 409, "EMAIL_EXISTS");
  }

  const existingPhone = await userRepo.findByPhone(phone);
  if (existingPhone) throw new AppError("Phone already in use", 409, "PHONE_EXISTS");

  const hashed = await bcrypt.hash(password, 12);
  const user = await userRepo.createUser({
    name,
    email: normalizedEmail,
    phone: String(phone).trim(),
    password: hashed,
    role,
    status: "active",
  });

  const auth = await createSessionTokens(user, meta);
  await auditService.log({
    actor: { _id: user._id, role: user.role },
    action: "auth.register",
    entityType: "User",
    entityId: user._id,
    metadata: { role: user.role },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  return auth;
}

async function login({ identifier, password }, meta = {}) {
  const id = String(identifier || "").trim();
  const isEmail = id.includes("@");

  const user = isEmail
    ? await userRepo.findByEmail(id, { includePassword: true })
    : await userRepo.findByPhone(id, { includePassword: true });

  if (!user) throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  if (user.status !== "active") throw new AppError("Account disabled", 403, "ACCOUNT_DISABLED");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  await assertInfluencerAccessAllowed(user.role);

  const auth = await createSessionTokens(user, meta);
  await auditService.log({
    actor: { _id: user._id, role: user.role },
    action: "auth.login",
    entityType: "User",
    entityId: user._id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  return auth;
}

async function refreshSession(refreshToken, meta = {}) {
  if (!refreshToken) throw new AppError("Refresh token required", 401, "UNAUTHORIZED");

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError("Invalid or expired refresh token", 401, "UNAUTHORIZED");
  }

  const session = await sessionRepo.findById(payload.sid);
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new AppError("Session expired", 401, "UNAUTHORIZED");
  }

  const incomingHash = hashToken(refreshToken);
  if (session.refreshTokenHash !== incomingHash || String(session.userId) !== String(payload.sub)) {
    await sessionRepo.revokeById(payload.sid);
    throw new AppError("Session mismatch", 401, "UNAUTHORIZED");
  }

  const user = await userRepo.findById(payload.sub);
  if (!user || user.status !== "active") {
    throw new AppError("Account unavailable", 401, "UNAUTHORIZED");
  }

  await assertInfluencerAccessAllowed(user.role);

  const rotatedRefreshToken = signRefreshToken({ user, sessionId: session._id });
  const accessToken = signAccessToken(user);
  await sessionRepo.updateById(session._id, {
    refreshTokenHash: hashToken(rotatedRefreshToken),
    lastUsedAt: new Date(),
    userAgent: meta.userAgent || session.userAgent,
    ipAddress: meta.ipAddress || session.ipAddress,
  });

  await auditService.log({
    actor: { _id: user._id, role: user.role },
    action: "auth.refresh",
    entityType: "Session",
    entityId: session._id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken: rotatedRefreshToken,
    user: normalizeUser(user),
  };
}

async function logout(refreshToken, actor, meta = {}) {
  if (!refreshToken) return { loggedOut: true };

  try {
    const payload = verifyRefreshToken(refreshToken);
    await sessionRepo.revokeById(payload.sid);
    await auditService.log({
      actor: actor || { _id: payload.sub, role: payload.role },
      action: "auth.logout",
      entityType: "Session",
      entityId: payload.sid,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  } catch (error) {
    return { loggedOut: true };
  }

  return { loggedOut: true };
}

async function logoutAll(userId, meta = {}) {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");

  await sessionRepo.revokeAllForUser(userId);
  await auditService.log({
    actor: { _id: user._id, role: user.role },
    action: "auth.logout_all",
    entityType: "User",
    entityId: user._id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  return { loggedOut: true };
}

async function me(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  return normalizeUser(user);
}

async function updateThemePreference(userId, theme, meta = {}) {
  if (!["light", "dark"].includes(theme)) {
    throw new AppError("Theme must be 'light' or 'dark'", 400, "VALIDATION_ERROR");
  }

  const user = await userRepo.findById(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");

  const updated = await userRepo.updateById(userId, {
    "preferences.theme": theme,
  });

  await auditService.log({
    actor: { _id: user._id, role: user.role },
    action: "auth.theme.updated",
    entityType: "User",
    entityId: user._id,
    metadata: { theme },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return normalizeUser(updated);
}

module.exports = {
  register,
  login,
  refreshSession,
  logout,
  logoutAll,
  me,
  updateThemePreference,
};
