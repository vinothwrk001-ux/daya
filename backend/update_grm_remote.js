require('dotenv').config();
const mongoose = require('mongoose');
const { Category } = require('./src/models/Category');

async function run() {
  try {
    console.log('Connecting to remote MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected to remote DB.');
    
    const category = await Category.findOne({ name: /grm/i });
    if (category) {
      console.log('Found category:', category.name);
      category.thumbnailUrl = '/uploads/uchooseme.png';
      category.logo = '/uploads/uchooseme.png';
      category.icon = '';
      await category.save();
      console.log('Category updated successfully in Atlas!');
    } else {
      console.log('Category GRM not found in Atlas DB either.');
      
      const all = await Category.find({});
      console.log('Available categories in Atlas:', all.map(c => c.name));
    }
  } catch (err) {
    console.error('Error connecting to Atlas:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
