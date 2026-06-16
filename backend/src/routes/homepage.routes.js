const express = require("express");
const categoryController = require("../controllers/category.controller");

const router = express.Router();

router.get("/hero-banner", categoryController.getHeroBannerCategories);

module.exports = router;
