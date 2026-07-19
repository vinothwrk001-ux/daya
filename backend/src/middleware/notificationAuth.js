const { authenticate } = require("./auth/authenticate");

// notificationAuth Required previously allowed ANY token (User, Legacy Admin, Staff)
// and attached it to req.notificationActor, which our unified `authenticate` now handles automatically.
const notificationAuthRequired = authenticate({ types: ["user", "legacy_admin", "staff"] });

module.exports = { notificationAuthRequired };
