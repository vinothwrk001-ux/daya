const express = require("express");
const homepageLayoutController = require("../controllers/homepage-layout.controller");

const router = express.Router();

router.get("/containers/schema/:type", homepageLayoutController.getBuilderContainerSchema);
router.get("/containers", homepageLayoutController.listContainerLibrary);
router.get("/public", homepageLayoutController.getPublicLayout);

module.exports = router;
