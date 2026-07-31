const crypto = require('crypto');
const sitemapService = require('../services/sitemap.service');
const robotsService = require('../services/robots.service');
const sitemapBuilder = require('../utils/sitemap.builder');
const cacheManager = require('../utils/cache.manager');
const { logger } = require('../utils/logger');

function setCacheHeaders(res, etag, lastModified) {
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  if (etag) {
    res.setHeader('ETag', `"${etag}"`);
  }
  if (lastModified) {
    res.setHeader('Last-Modified', new Date(lastModified).toUTCString());
  }
}

function checkNotModified(req, res, etag, lastModified) {
  if (etag && req.headers['if-none-match'] === `"${etag}"`) {
    res.status(304).end();
    return true;
  }
  if (lastModified && req.headers['if-modified-since']) {
    const ifModifiedSince = new Date(req.headers['if-modified-since']).getTime();
    const lastModTime = new Date(lastModified).getTime();
    if (ifModifiedSince >= lastModTime) {
      res.status(304).end();
      return true;
    }
  }
  return false;
}

class SitemapController {
  
  // GET /sitemap.xml
  async getSitemapIndex(req, res) {
    try {
      const cacheKey = 'sitemap:index';
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) {
        if (checkNotModified(req, res, cached.metadata.etag, cached.metadata.lastModified)) return;
        setCacheHeaders(res, cached.metadata.etag, cached.metadata.lastModified);
        res.type('application/xml');
        return res.send(cached.value);
      }

      const counts = await sitemapService.getCounts();
      const urls = [];
      const now = new Date().toISOString();
      const URL_LIMIT = 50000;

      // Static
      if (counts.static && counts.static.count > 0) {
        urls.push({ loc: 'sitemaps/static.xml', lastmod: counts.static.lastmod || now });
      }

      const addUrls = (type, countObj) => {
        if (!countObj || countObj.count === 0) return;
        const pages = Math.ceil(countObj.count / URL_LIMIT);
        if (pages === 1) {
            urls.push({ loc: `sitemaps/${type}.xml`, lastmod: countObj.lastmod || now });
        } else {
            for (let i = 1; i <= pages; i++) {
              urls.push({ loc: `sitemaps/${type}-${i}.xml`, lastmod: countObj.lastmod || now });
            }
        }
      };

      addUrls('products', counts.products);
      addUrls('categories', counts.categories);
      addUrls('brands', counts.brands);
      addUrls('blogs', counts.blogs);
      addUrls('services', counts.services);
      addUrls('images', counts.images);
      addUrls('videos', counts.videos);

      const xml = sitemapBuilder.buildSitemapIndex(urls);
      
      const etag = crypto.createHash('md5').update(xml).digest('hex');
      await cacheManager.set(cacheKey, xml, { etag, lastModified: now }, 3600); // cache for 1 hour

      setCacheHeaders(res, etag, now);
      res.type('application/xml');
      res.send(xml);
    } catch (error) {
      logger.error('Error generating sitemap index', { error });
      res.status(500).send('Error generating sitemap index');
    }
  }

  // GET /sitemaps/:type-:page.xml
  async getSitemapChunk(req, res) {
    try {
      const { type, page } = req.params;
      const pageNum = parseInt(page, 10) || 1;
      
      const cacheKey = `sitemap:${type}:${pageNum}`;
      const cached = await cacheManager.get(cacheKey);

      if (cached) {
        if (checkNotModified(req, res, cached.metadata.etag, cached.metadata.lastModified)) return;
        setCacheHeaders(res, cached.metadata.etag, cached.metadata.lastModified);
        res.type('application/xml');
        return res.send(cached.value);
      }

      res.type('application/xml');
      
      let cursor;
      let mapFn;

      switch (type) {
        case 'static':
          cursor = sitemapService.getStaticPages();
          mapFn = (doc) => doc;
          break;
        case 'products':
          cursor = sitemapService.getProductCursor(pageNum);
          mapFn = sitemapService.mapProductToUrl.bind(sitemapService);
          break;
        case 'categories':
          cursor = sitemapService.getCategoryCursor(pageNum);
          mapFn = sitemapService.mapCategoryToUrl.bind(sitemapService);
          break;
        case 'brands':
        case 'blogs':
        case 'services':
        case 'images':
        case 'videos':
          cursor = sitemapService.getStubCursor();
          mapFn = sitemapService.mapStubToUrl.bind(sitemapService);
          break;
        default:
          return res.status(404).send('Sitemap type not found');
      }

      const stream = sitemapBuilder.generateSitemapStream(cursor, mapFn, cacheKey);
      
      let xmlData = '';
      stream.on('data', (chunk) => {
        xmlData += chunk;
      });
      stream.on('end', async () => {
        const etag = crypto.createHash('md5').update(xmlData).digest('hex');
        const lastModified = new Date().toISOString();
        await cacheManager.set(cacheKey, xmlData, { etag, lastModified }, 86400); // cache for 24 hours
      });

      // Headers cannot be fully set for stream because ETag is not known until stream ends, 
      // but next time it will be cached.
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      stream.pipe(res);

    } catch (error) {
      logger.error('Error generating sitemap chunk', { error });
      res.status(500).send('Error generating sitemap chunk');
    }
  }

  // GET /robots.txt
  async getRobotsTxt(req, res) {
    try {
      const cacheKey = 'robots.txt';
      let cached = await cacheManager.get(cacheKey);
      
      if (!cached) {
        const value = robotsService.generateRobotsTxt();
        const etag = crypto.createHash('md5').update(value).digest('hex');
        const lastModified = new Date().toISOString();
        cached = { value, metadata: { etag, lastModified } };
        await cacheManager.set(cacheKey, value, cached.metadata, 86400); // 24 hours
      }

      if (checkNotModified(req, res, cached.metadata.etag, cached.metadata.lastModified)) return;
      setCacheHeaders(res, cached.metadata.etag, cached.metadata.lastModified);
      
      res.type('text/plain');
      res.send(cached.value);
    } catch (error) {
      logger.error('Error generating robots.txt', { error });
      res.status(500).send('Error generating robots.txt');
    }
  }
}

module.exports = new SitemapController();
