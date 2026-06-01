const express = require("express");
const { privateDocumentAuth } = require("../middleware/privateDocumentAuth");
const privateDocumentController = require("../controllers/privateDocument.controller");

const router = express.Router();

router.get("/:documentId/access", privateDocumentAuth, privateDocumentController.accessPrivateDocument);

module.exports = router;
