const mongoose = require('mongoose');
const { Category } = require('./src/models/Category');
const { Product } = require('./src/models/Product');

async function run() {
  try {
    console.log('Connecting to local MongoDB...');
    await mongoose.connect('mongodb://127.0.0.1:27017/Daya_Creatives', { serverSelectionTimeoutMS: 3000 });
    console.log('Connected.');
    
    const category = await Category.findOne({ name: /grm/i });
    if (category) {
      console.log('Found category:', category.name);
      category.thumbnailUrl = '/uploads/uchooseme.png';
      category.logo = '/uploads/uchooseme.png';
      category.icon = '';
      await category.save();
      console.log('Category thumbnail updated successfully.');
      
      // The user mentioned "remove the pdf file inside that"
      // Maybe there is a product in this category that is a PDF?
      const products = await Product.find({ category: category._id });
      console.log(`Found ${products.length} products in this category.`);
      for (const prod of products) {
        // Is there a pdf or document attached?
        if (prod.name.toLowerCase().includes('pdf') || (prod.files && prod.files.length > 0)) {
           console.log('Found product with pdf/files:', prod.name);
           // We might need to delete this product or remove its file
        }
      }
    } else {
      console.log('Category GRM not found');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
