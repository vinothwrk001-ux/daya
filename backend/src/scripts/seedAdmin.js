const { logger } = require("../utils/logger");
require("dotenv").config();

const bcrypt = require("bcryptjs");
const { connectDb } = require("../config/db");
const userRepo = require("../repositories/user.repository");

async function main() {
  await connectDb();

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";
  const phone = process.env.ADMIN_PHONE || "0000000000";

  if (!email || !password) {
    throw new Error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in env");
  }

  const existing = await userRepo.findByEmail(email);
  if (existing) {
    // eslint-disable-next-line no-console
    logger.info("Admin already exists:", { value: existing.email });
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await userRepo.createUser({
    name,
    email,
    phone,
    password: hashed,
    role: "admin",
    status: "active",
  });

  // eslint-disable-next-line no-console
  logger.info("Admin created:", { value: user.email });
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  logger.error("script_error", { error: err });
  process.exit(1);
});

