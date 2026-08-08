/**
 * Self-hosted Prerender Server
 * 
 * This runs a standalone prerender server using headless Chrome/Chromium
 * to generate HTML snapshots of the SPA for search engine crawlers.
 * 
 * Usage:
 *   npm run prerender:start
 * 
 * The prerender-node middleware in app.js forwards bot requests to this server.
 * 
 * Requirements:
 *   - Chrome or Chromium must be installed on the server
 *   - Install: sudo apt-get install chromium-browser (Ubuntu/Debian)
 */

const prerender = require('prerender');

const server = prerender({
  port: process.env.PRERENDER_PORT || 3000,
  // Cache rendered pages in memory for 1 hour to reduce Chrome usage
  pageDoneCheckTimeout: 10000,
  waitAfterLastRequest: 500,
});

// Built-in plugins
server.use(prerender.sendPrerenderHeader());
server.use(prerender.removeScriptTags());
server.use(prerender.httpHeaders());
// In-memory cache plugin to avoid re-rendering the same page repeatedly
server.use(prerender.inMemoryHtmlCache());

server.start();

console.log(`Prerender server started on port ${process.env.PRERENDER_PORT || 3000}`);
