const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  assertDocumentAccess,
  resolveStoragePath,
  getAuthorizedDocumentAccess,
} = require("../privateDocument.service");

const DOCUMENT_ID = "507f1f77bcf86cd799439011";
const OWNER_ID = "507f1f77bcf86cd799439012";
const OTHER_ID = "507f1f77bcf86cd799439013";

function doc(overrides = {}) {
  return {
    _id: DOCUMENT_ID,
    ownerType: "customer",
    ownerId: OWNER_ID,
    documentType: "passport",
    category: "identity",
    storageKey: "kyc/passport.pdf",
    mimeType: "application/pdf",
    status: "pending",
    ...overrides,
  };
}

function req(actor = {}) {
  return {
    ip: "127.0.0.1",
    originalUrl: `/api/private-documents/${DOCUMENT_ID}/access`,
    get: () => "node-test",
    user: actor.user,
    staff: actor.staff,
  };
}

test("owner can access only their own private document", () => {
  assert.doesNotThrow(() =>
    assertDocumentAccess({ id: OWNER_ID, role: "user", roles: ["user"], authType: "user" }, doc())
  );

  assert.throws(
    () => assertDocumentAccess({ id: OTHER_ID, role: "user", roles: ["user"], authType: "user" }, doc()),
    /Access denied/
  );
});

test("cross-customer private document access is denied", () => {
  assert.throws(
    () => assertDocumentAccess({ id: OTHER_ID, role: "user", roles: ["user"], authType: "user" }, doc()),
    /Access denied/
  );
});

test("finance admin access is limited to financial document categories", () => {
  assert.doesNotThrow(() =>
    assertDocumentAccess({ id: OTHER_ID, role: "finance_admin", roles: ["finance_admin"], authType: "user" }, doc({ category: "finance", documentType: "finance_report" }))
  );

  assert.throws(
    () => assertDocumentAccess({ id: OTHER_ID, role: "finance_admin", roles: ["finance_admin"], authType: "user" }, doc({ category: "identity" })),
    /Access denied/
  );
});

test("support and staff permissions enforce compliance and financial boundaries", () => {
  assert.doesNotThrow(() =>
    assertDocumentAccess(
      { id: OTHER_ID, role: "support_admin", roles: ["support_admin"], authType: "user" },
      doc({ category: "identity" })
    )
  );

  assert.throws(
    () =>
      assertDocumentAccess(
        { id: OTHER_ID, role: "staff", authType: "staff", permissions: { products: { read: true } } },
        doc({ category: "bank" })
      ),
    /Access denied/
  );
});

test("path traversal storage keys are rejected before filesystem access", () => {
  assert.throws(() => resolveStoragePath("../secret.pdf"), /storage key is invalid/);
  assert.throws(() => resolveStoragePath(path.resolve("secret.pdf")), /storage key is invalid/);
});

test("document access logs failed enumeration attempts", async () => {
  const logs = [];
  const deps = {
    PrivateDocument: {
      findById() {
        return { lean: async () => null };
      },
    },
    DocumentAccessLog: {
      async create(payload) {
        logs.push(payload);
      },
    },
    fs: {
      promises: {
        async access() {},
      },
    },
  };

  await assert.rejects(
    () => getAuthorizedDocumentAccess(DOCUMENT_ID, req({ user: { sub: OTHER_ID, role: "user", roles: ["user"] } }), deps),
    /Access denied/
  );

  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "FAILED_ACCESS");
  assert.equal(logs[0].outcome, "DENIED");
});
