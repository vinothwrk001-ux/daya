const cacheManager = require('./cache.manager');
const { logger } = require('./logger');

/**
 * Global mongoose plugin to invalidate sitemap cache upon changes.
 */
function sitemapCachePlugin(schema) {
  const invalidateCache = async function (doc) {
    // Note: doc might be undefined for updateMany/deleteMany, but 'this' refers to the Query.
    try {
      const modelName = this.modelName || (doc && doc.constructor && doc.constructor.modelName);
      if (!modelName) return;

      // Invalidate the index always
      await cacheManager.invalidatePrefix('index');
      
      const lowerModelName = modelName.toLowerCase();
      // Only invalidate specific chunks for recognized types
      if (['product', 'category', 'blog', 'brand', 'service', 'image', 'video'].includes(lowerModelName)) {
        // e.g. sitemap:products
        await cacheManager.invalidatePrefix(lowerModelName + 's');
        if (lowerModelName === 'category') {
            await cacheManager.invalidatePrefix('categories');
        }
      }
    } catch (err) {
      logger.error(`Error invalidating sitemap cache: ${err.message}`);
    }
  };

  schema.post('save', invalidateCache);
  schema.post('findOneAndUpdate', invalidateCache);
  schema.post('findOneAndDelete', invalidateCache);
  schema.post('findOneAndRemove', invalidateCache);
  schema.post('deleteOne', invalidateCache);
  schema.post('updateMany', invalidateCache);
  schema.post('deleteMany', invalidateCache);
}

module.exports = sitemapCachePlugin;
