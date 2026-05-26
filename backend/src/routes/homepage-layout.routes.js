const express = require("express");
const homepageLayoutController = require("../controllers/homepage-layout.controller");

const router = express.Router();

router.get("/public", homepageLayoutController.getPublicLayout);

module.exports = router;
