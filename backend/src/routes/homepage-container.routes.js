const express = require("express");
const homepageContainerController = require("../controllers/homepage-container.controller");

const router = express.Router();

router.get("/schemas", homepageContainerController.listContainerSchemas);
router.get("/schema/:type", homepageContainerController.getContainerSchema);
router.post("/:id/track", express.json(), homepageContainerController.trackPublicContainerEvent);
router.get("/", homepageContainerController.listPublicContainers);
router.get("/:slug/products", homepageContainerController.getContainerProductsBySlug);

module.exports = router;
