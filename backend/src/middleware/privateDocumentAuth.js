const { authenticate } = require("./auth/authenticate");

// privateDocumentAuth previously allowed ANY token (User, Legacy Admin, Staff)
const privateDocumentAuth = authenticate({ types: ["user", "legacy_admin", "staff"] });

module.exports = { privateDocumentAuth };
