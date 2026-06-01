const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createApp } = require("../../app");
const {
  bootstrapPlatformDefaults,
  DEFAULT_PLATFORM_CONFIGS,
} = require("../platform-bootstrap.service");
const {
  assertNoProductionBootstrapRoutes,
  stripJavaScriptComments,
} = require("../../utils/bootstrapRouteScanner");

function leanQuery(value) {
  return {
    lean: async () => value,
  };
}

function createMemoryDeps({ existingLock = null } = {}) {
  const configs = new Map();
  const auditLogs = [];
  let lock = existingLock;

  return {
    auditLogs,
    configs,
    PlatformConfig: {
      async findOne(query) {
        return configs.get(query.key) || null;
      },
      async create(payload) {
        const doc = { _id: `cfg_${payload.key}`, ...payload };
        configs.set(payload.key, doc);
        return doc;
      },
    },
    SystemBootstrap: {
      findOne() {
        return leanQuery(lock);
      },
      async findOneAndUpdate(_query, update) {
        lock = {
          _id: "bootstrap_lock",
          bootstrapKey: "platform-default-config",
          ...update.$set,
        };
        return lock;
      },
    },
    SecurityAuditLog: {
      async create(payload) {
        auditLogs.push(payload);
        return payload;
      },
    },
  };
}

function request(app, { method = "GET", path: requestPath = "/" } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const req = http.request(
        {
          method,
          port,
          path: requestPath,
          host: "127.0.0.1",
          headers: {
            origin: "http://localhost:5173",
          },
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            server.close(() => resolve({ statusCode: res.statusCode, body }));
          });
        }
      );
      req.on("error", (error) => {
        server.close(() => reject(error));
      });
      req.end();
    });
  });
}

test("config initialization is not exposed as an HTTP route in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCors = process.env.CORS_ORIGINS;
  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGINS = "http://localhost:5173";

  try {
    const app = createApp();
    const response = await request(app, {
      method: "POST",
      path: "/api/config/initialize-defaults",
    });
    assert.equal(response.statusCode, 404);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousCors === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = previousCors;
    }
  }
});

test("platform bootstrap creates defaults once and writes security audit logs", async () => {
  const deps = createMemoryDeps();

  const result = await bootstrapPlatformDefaults({
    environment: "test",
    actor: { id: "cli-test", role: "system" },
    serverId: "test-server",
    deps,
  });

  assert.equal(result.created.length, DEFAULT_PLATFORM_CONFIGS.length);
  assert.equal(result.skipped.length, 0);
  assert.equal(deps.configs.size, DEFAULT_PLATFORM_CONFIGS.length);
  assert.deepEqual(
    deps.auditLogs.map((entry) => entry.action),
    ["PLATFORM_BOOTSTRAP_ATTEMPT", "PLATFORM_BOOTSTRAP_SUCCESS"]
  );
});

test("platform bootstrap blocks reinitialization after completion", async () => {
  const deps = createMemoryDeps({
    existingLock: {
      bootstrapKey: "platform-default-config",
      bootstrapCompleted: true,
      bootstrapExecutedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  await assert.rejects(
    () =>
      bootstrapPlatformDefaults({
        environment: "test",
        actor: { id: "cli-test", role: "system" },
        deps,
      }),
    /already been completed/
  );

  assert.equal(
    deps.auditLogs.some(
      (entry) =>
        entry.action === "PLATFORM_BOOTSTRAP_REINITIALIZATION_ATTEMPT" &&
        entry.status === "BLOCKED"
    ),
    true
  );
});

test("production bootstrap scanner ignores comments but blocks route markers", () => {
  const source = stripJavaScriptComments(`
    // router.post("/bootstrap", handler)
    /*
      router.post("/initialize-defaults", handler)
    */
    router.get("/safe", handler);
  `);
  assert.equal(source.includes("initialize-defaults"), false);
  assert.equal(source.includes("bootstrap"), false);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-route-scan-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "safe.routes.js"), 'router.get("/health", handler);');
    assert.deepEqual(assertNoProductionBootstrapRoutes({ nodeEnv: "production", routesDir: tmpDir }), []);

    fs.writeFileSync(path.join(tmpDir, "unsafe.routes.js"), 'router.post("/bootstrap", handler);');
    assert.throws(
      () => assertNoProductionBootstrapRoutes({ nodeEnv: "production", routesDir: tmpDir }),
      /Production startup blocked/
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
