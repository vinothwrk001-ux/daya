const express = require('express');
const compression = require('compression');
const sitemapController = require('../controllers/sitemap.controller');

const router = express.Router();

// Apply compression specifically for sitemap XML outputs to handle gzip/brotli
router.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Only compress XML for these routes
    return res.getHeader('Content-Type') === 'application/xml' || compression.filter(req, res);
  }
}));

router.get('/sitemap.xml', sitemapController.getSitemapIndex);
router.get('/sitemaps/:type.xml', (req, res, next) => { req.params.page = '1'; next(); }, sitemapController.getSitemapChunk);
router.get('/sitemaps/:type-:page.xml', sitemapController.getSitemapChunk);
router.get('/robots.txt', sitemapController.getRobotsTxt);

module.exports = router;
