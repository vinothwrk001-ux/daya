require('dotenv').config();
const mongoose = require('mongoose');
const { Category } = require('./src/models/Category');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Daya_Creatives');
  
  const category = await Category.findOne({ name: /grm/i });
  if (category) {
    console.log('Found category:', category.toObject());
  } else {
    console.log('Category GRM not found');
  }
  process.exit(0);
}

run();
