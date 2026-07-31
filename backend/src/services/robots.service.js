class RobotsService {
  constructor() {
    let baseDomain = process.env.BASE_URL || process.env.FRONTEND_URL || 'https://dayacreatives.com';
    if (baseDomain.includes('localhost') || baseDomain.includes('127.0.0.1')) {
      baseDomain = 'https://dayacreatives.com';
    }
    this.domain = baseDomain.endsWith('/') ? baseDomain.slice(0, -1) : baseDomain;
  }

  generateRobotsTxt() {
    let txt = `User-agent: *\n`;
    txt += `Allow: /\n`;
    
    const disallowedPaths = [
      '/admin',
      '/api',
      '/checkout',
      '/cart',
      '/login',
      '/register',
      '/profile',
      '/wishlist'
    ];

    disallowedPaths.forEach(path => {
      txt += `Disallow: ${path}\n`;
    });

    txt += `\nSitemap: ${this.domain}/sitemap.xml\n`;

    return txt;
  }
}

module.exports = new RobotsService();
