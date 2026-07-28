require('dotenv').config();
const mongoose = require('mongoose');
const ServiceRequest = require('./src/models/ServiceRequest');

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  const data = await ServiceRequest.find({});
  console.log("DB DATA:", data);
  mongoose.disconnect();
}
checkDb();
