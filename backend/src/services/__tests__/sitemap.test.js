const test = require('node:test');
const assert = require('node:assert');
const sitemapBuilder = require('../../utils/sitemap.builder');
const sitemapService = require('../sitemap.service');

test('Sitemap Builder - escapeXML', (t) => {
  const result = sitemapBuilder.escapeXML('http://example.com/test?a=1&b=2<3>"\'');
  assert.strictEqual(result, 'http://example.com/test?a=1&amp;b=2&lt;3&gt;&quot;&apos;');
});

test('Sitemap Builder - buildUrlNode', (t) => {
  const urlData = {
    loc: 'https://dayacreatives.com/test',
    lastmod: '2023-01-01T00:00:00.000Z',
    changefreq: 'daily',
    priority: 0.8
  };
  
  const xml = sitemapBuilder.buildUrlNode(urlData);
  assert.ok(xml.includes('<loc>https://dayacreatives.com/test</loc>'));
  assert.ok(xml.includes('<lastmod>2023-01-01T00:00:00.000Z</lastmod>'));
  assert.ok(xml.includes('<changefreq>daily</changefreq>'));
  assert.ok(xml.includes('<priority>0.8</priority>'));
});

test('Sitemap Service - getStaticPages', (t) => {
  const staticPages = sitemapService.getStaticPages();
  assert.ok(Array.isArray(staticPages));
  assert.ok(staticPages.length > 0);
  
  const home = staticPages.find(p => p.priority === 1.0);
  assert.ok(home);
  // Service adds absolute prefix
  assert.ok(home.loc.startsWith('http'));
});

test('Sitemap Service - mapProductToUrl absolute URLs', (t) => {
  const doc = {
    slug: 'test-product',
    updatedAt: new Date('2023-01-01'),
    images: [{ url: '/uploads/img1.jpg', altText: 'Test' }]
  };
  
  const urlData = sitemapService.mapProductToUrl(doc);
  assert.ok(urlData.loc.startsWith('http'));
  assert.ok(urlData.loc.includes('/product/test-product'));
  assert.strictEqual(urlData.images.length, 1);
  assert.ok(urlData.images[0].loc.startsWith('http'));
});
