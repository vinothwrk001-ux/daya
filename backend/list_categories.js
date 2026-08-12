const mongoose = require('mongoose');
const { Category } = require('./src/models/Category');

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/Daya_Creatives', { serverSelectionTimeoutMS: 3000 });
    const categories = await Category.find({});
    console.log('All categories:', categories.map(c => ({ id: c._id, name: c.name, code: c.code, slug: c.slug })));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
