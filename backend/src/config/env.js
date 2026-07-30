const dotenv = require("dotenv");

if (!global.__dayaEnvLoaded) {
  dotenv.config({ override: true });
  global.__dayaEnvLoaded = true;
}
