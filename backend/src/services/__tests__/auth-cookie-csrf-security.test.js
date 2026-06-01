const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

process.env.ENCRYPTION_MASTER_KEY =
  process.env.ENCRYPTION_MASTER_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const { createApp } = require("../../app");
const { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } = require("../../middleware/csrf");

function request(app, { method = "GET", path: requestPath = "/", headers = {}, body = "" } = {}) {
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
            ...headers,
          },
        },
        (res) => {
          let responseBody = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            responseBody += chunk;
          });
          res.on("end", () => {
            server.close(() =>
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: responseBody,
              })
            );
          });
        }
      );
      req.on("error", (error) => {
        server.close(() => reject(error));
      });
      if (body) req.write(body);
      req.end();
    });
  });
}

function parseJson(response) {
  return JSON.parse(response.body || "{}");
}

test("CSRF endpoint issues a signed non-httpOnly double-submit cookie", async () => {
  const previousCors = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = "http://localhost:5173";

  try {
    const app = createApp();
    const response = await request(app, { path: "/api/auth/csrf" });
    const payload = parseJson(response);
    const cookie = response.headers["set-cookie"]?.find((value) => value.startsWith(`${CSRF_COOKIE_NAME}=`));

    assert.equal(response.statusCode, 200);
    assert.match(payload.data.csrfToken, /^[a-f0-9]{64}\.[a-f0-9]{64}$/);
    assert.ok(cookie);
    assert.equal(cookie.includes("HttpOnly"), false);
  } finally {
    if (previousCors === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = previousCors;
    }
  }
});

test("unsafe cookie-auth endpoints require a matching CSRF header", async () => {
  const previousCors = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = "http://localhost:5173";

  try {
    const app = createApp();
    const response = await request(app, {
      method: "POST",
      path: "/api/auth/refresh",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const payload = parseJson(response);

    assert.equal(response.statusCode, 403);
    assert.equal(payload.code, "CSRF_REQUIRED");
  } finally {
    if (previousCors === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = previousCors;
    }
  }
});

test("valid CSRF allows refresh endpoint to reach cookie refresh validation", async () => {
  const previousCors = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = "http://localhost:5173";

  try {
    const app = createApp();
    const csrfResponse = await request(app, { path: "/api/auth/csrf" });
    const csrfToken = parseJson(csrfResponse).data.csrfToken;
    const response = await request(app, {
      method: "POST",
      path: "/api/auth/refresh",
      headers: {
        "content-type": "application/json",
        cookie: `${CSRF_COOKIE_NAME}=${csrfToken}`,
        [CSRF_HEADER_NAME]: csrfToken,
      },
      body: "{}",
    });
    const payload = parseJson(response);

    assert.equal(response.statusCode, 401);
    assert.equal(payload.code, "UNAUTHORIZED");
  } finally {
    if (previousCors === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = previousCors;
    }
  }
});

test("legacy bearer authentication is rejected instead of accepted as compatibility auth", async () => {
  const previousCors = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = "http://localhost:5173";

  try {
    const app = createApp();
    const response = await request(app, {
      path: "/api/auth/me",
      headers: { authorization: "Bearer legacy-token" },
    });
    const payload = parseJson(response);

    assert.equal(response.statusCode, 410);
    assert.equal(payload.code, "LEGACY_AUTH_REMOVED");
  } finally {
    if (previousCors === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = previousCors;
    }
  }
});
