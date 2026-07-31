const { Readable } = require('stream');
const crypto = require('crypto');
const { logger } = require('./logger');

class SitemapBuilder {
  constructor(domain) {
    let baseDomain = process.env.BASE_URL || process.env.FRONTEND_URL || 'https://dayacreatives.com';
    if (baseDomain.includes('localhost') || baseDomain.includes('127.0.0.1')) {
      baseDomain = 'https://dayacreatives.com';
    }
    this.domain = baseDomain.endsWith('/') ? baseDomain.slice(0, -1) : baseDomain;
    this.URL_LIMIT = 50000;
  }

  escapeXML(str) {
    if (!str) return '';
    return str
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  buildImageNode(img) {
    if (!img || !img.loc) return '';
    let xml = `    <image:image>\n      <image:loc>${this.escapeXML(img.loc)}</image:loc>\n`;
    if (img.title) xml += `      <image:title>${this.escapeXML(img.title)}</image:title>\n`;
    if (img.caption) xml += `      <image:caption>${this.escapeXML(img.caption)}</image:caption>\n`;
    xml += `    </image:image>\n`;
    return xml;
  }

  buildVideoNode(video) {
    if (!video || !video.thumbnail_loc || !video.title || !video.description || !video.content_loc) return '';
    let xml = `    <video:video>\n`;
    xml += `      <video:thumbnail_loc>${this.escapeXML(video.thumbnail_loc)}</video:thumbnail_loc>\n`;
    xml += `      <video:title>${this.escapeXML(video.title)}</video:title>\n`;
    xml += `      <video:description>${this.escapeXML(video.description)}</video:description>\n`;
    xml += `      <video:content_loc>${this.escapeXML(video.content_loc)}</video:content_loc>\n`;
    xml += `    </video:video>\n`;
    return xml;
  }

  buildUrlNode(urlData) {
    if (!urlData || !urlData.loc) return '';
    
    let path = urlData.loc.startsWith('/') ? urlData.loc : `/${urlData.loc}`;
    if (urlData.loc.startsWith('http')) {
        path = urlData.loc;
    } else {
        path = `${this.domain}${path}`;
    }

    const loc = this.escapeXML(path);
    let xml = `  <url>\n    <loc>${loc}</loc>\n`;
    
    if (urlData.lastmod) {
      const date = new Date(urlData.lastmod);
      if (!isNaN(date.getTime())) {
        xml += `    <lastmod>${date.toISOString()}</lastmod>\n`;
      }
    }
    
    if (urlData.changefreq) {
      xml += `    <changefreq>${urlData.changefreq}</changefreq>\n`;
    }
    
    if (urlData.priority) {
      xml += `    <priority>${urlData.priority}</priority>\n`;
    }
    
    if (urlData.images && urlData.images.length > 0) {
      urlData.images.forEach(img => {
        xml += this.buildImageNode(img);
      });
    }

    if (urlData.videos && urlData.videos.length > 0) {
      urlData.videos.forEach(video => {
        xml += this.buildVideoNode(video);
      });
    }

    xml += `  </url>\n`;
    return xml;
  }

  generateSitemapStream(cursor, mapDocToUrlData, contextName = 'sitemap') {
    const self = this;
    let count = 0;
    const startTime = Date.now();
    const hash = crypto.createHash('md5');

    async function* generate() {
      const header = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';
      hash.update(header);
      yield header;

      try {
        if (Array.isArray(cursor)) {
          for (const doc of cursor) {
            if (count >= self.URL_LIMIT) break;
            const urlData = mapDocToUrlData(doc);
            if (urlData) {
              const node = self.buildUrlNode(urlData);
              hash.update(node);
              yield node;
              count++;
            }
          }
        } else if (cursor) {
          for await (const doc of cursor) {
            if (count >= self.URL_LIMIT) break;
            const urlData = mapDocToUrlData(doc);
            if (urlData) {
              const node = self.buildUrlNode(urlData);
              hash.update(node);
              yield node;
              count++;
            }
          }
        }
      } catch (err) {
        logger.error(`Error streaming sitemap ${contextName}: ${err.message}`, { error: err });
      }

      const footer = '</urlset>\n';
      hash.update(footer);
      yield footer;

      const duration = Date.now() - startTime;
      const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      
      logger.info(`Sitemap generated: ${contextName}`, {
        urlCount: count,
        durationMs: duration,
        heapUsedMb: memUsage.toFixed(2),
        etag: hash.digest('hex')
      });
    }

    return Readable.from(generate());
  }

  buildSitemapIndex(sitemapUrls) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    sitemapUrls.forEach(url => {
        let path = url.loc.startsWith('/') ? url.loc : `/${url.loc}`;
        if (!url.loc.startsWith('http')) {
            path = `${this.domain}${path}`;
        } else {
            path = url.loc;
        }

        xml += `  <sitemap>\n`;
        xml += `    <loc>${this.escapeXML(path)}</loc>\n`;
        if (url.lastmod) {
            const date = new Date(url.lastmod);
            if (!isNaN(date.getTime())) {
                xml += `    <lastmod>${date.toISOString()}</lastmod>\n`;
            }
        }
        xml += `  </sitemap>\n`;
    });

    xml += '</sitemapindex>\n';
    return xml;
  }
}

module.exports = new SitemapBuilder();
