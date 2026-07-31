const mongoose = require('mongoose');
const { Product } = require('../models/product/index');
const { Category } = require('../models/Category');
const { Subcategory } = require('../models/Subcategory');

// Constants for limits
const URL_LIMIT = 50000;

class SitemapService {
  constructor() {
    let baseDomain = process.env.BASE_URL || process.env.FRONTEND_URL || 'https://dayacreatives.com';
    if (baseDomain.includes('localhost') || baseDomain.includes('127.0.0.1')) {
      baseDomain = 'https://dayacreatives.com';
    }
    this.domain = baseDomain.endsWith('/') ? baseDomain.slice(0, -1) : baseDomain;
    this.startupDate = process.env.APP_DEPLOYMENT_TIMESTAMP || new Date().toISOString();
  }

  // --- Static Pages ---
  
  getStaticPages() {
    const staticPaths = [
      { loc: '', priority: 1.0, changefreq: 'daily' }, // Homepage
      { loc: 'about', priority: 0.8, changefreq: 'monthly' },
      { loc: 'services', priority: 0.8, changefreq: 'weekly' },
      { loc: 'contact', priority: 0.5, changefreq: 'yearly' },
      { loc: 'search', priority: 0.5, changefreq: 'yearly' },
      { loc: 'offers', priority: 0.8, changefreq: 'daily' },
      { loc: 'blog', priority: 0.8, changefreq: 'daily' },
      { loc: 'privacy-policy', priority: 0.5, changefreq: 'yearly' },
      { loc: 'terms', priority: 0.5, changefreq: 'yearly' },
      { loc: 'refund-policy', priority: 0.5, changefreq: 'yearly' },
    ];

    return staticPaths.map(p => ({
      ...p,
      loc: `${this.domain}/${p.loc}`,
      lastmod: this.startupDate
    }));
  }

  // --- Counts for Indexing ---

  async getCounts() {
    const getModelStats = async (Model, query = {}) => {
      if (!Model) return { count: 0, lastmod: null };
      const count = await Model.countDocuments(query);
      if (count === 0) return { count: 0, lastmod: null };
      const latest = await Model.findOne(query).sort({ updatedAt: -1 }).select('updatedAt');
      return { count, lastmod: latest ? latest.updatedAt : null };
    };

    const products = await getModelStats(Product, { isActive: true, status: 'PUBLISHED' });
    const categories = await getModelStats(Category, { isActive: true });
    
    // Dynamically check for future models if they exist in mongoose
    const blogs = await getModelStats(mongoose.models.Blog, { isActive: true });
    const brands = await getModelStats(mongoose.models.Brand, { isActive: true });
    const services = await getModelStats(mongoose.models.Service, { isActive: true });
    // Also check generic image/video models if they exist later
    const images = await getModelStats(mongoose.models.Image, {});
    const videos = await getModelStats(mongoose.models.Video, {});

    return {
      static: { count: 1, lastmod: this.startupDate },
      products,
      categories,
      blogs,
      brands,
      services,
      images,
      videos
    };
  }

  // --- Cursors for Streaming ---

  getProductCursor(page = 1) {
    const skip = (page - 1) * URL_LIMIT;
    // We only include active/published products
    return Product.find({ isActive: true, status: 'PUBLISHED' })
      .select('slug updatedAt createdAt images name description price discountPrice stock attributes category')
      .skip(skip)
      .limit(URL_LIMIT)
      .cursor();
  }

  mapProductToUrl(doc) {
    const images = [];
    if (doc.images && Array.isArray(doc.images)) {
      doc.images.forEach(img => {
        if (img.url) {
          images.push({
            loc: img.url.startsWith('http') ? img.url : `${this.domain}${img.url.startsWith('/') ? '' : '/'}${img.url}`,
            title: doc.name,
            caption: img.altText || doc.name
          });
        }
      });
    }

    return {
      loc: `${this.domain}/product/${doc.slug}`,
      lastmod: doc.updatedAt || doc.createdAt,
      changefreq: 'daily',
      priority: 0.9,
      images
    };
  }

  getCategoryCursor(page = 1) {
    const skip = (page - 1) * URL_LIMIT;
    return Category.find({ isActive: true })
      .select('slug updatedAt createdAt name images')
      .skip(skip)
      .limit(URL_LIMIT)
      .cursor();
  }

  mapCategoryToUrl(doc) {
    const images = [];
    if (doc.images && Array.isArray(doc.images)) {
        doc.images.forEach(img => {
          if (img.url) {
            images.push({
              loc: img.url.startsWith('http') ? img.url : `${this.domain}${img.url.startsWith('/') ? '' : '/'}${img.url}`,
              title: doc.name
            });
          }
        });
    } else if (typeof doc.image === 'string' && doc.image) {
        images.push({ 
          loc: doc.image.startsWith('http') ? doc.image : `${this.domain}${doc.image.startsWith('/') ? '' : '/'}${doc.image}`, 
          title: doc.name 
        });
    }

    return {
      loc: `${this.domain}/category/${doc.slug}`,
      lastmod: doc.updatedAt || doc.createdAt,
      changefreq: 'weekly',
      priority: 0.8,
      images
    };
  }

  // --- Stubs for requested dynamic routes that might not have models yet ---

  getStubCursor() {
    return []; // Empty array works with SitemapBuilder
  }

  mapStubToUrl(doc) {
    return null;
  }
}

module.exports = new SitemapService();
