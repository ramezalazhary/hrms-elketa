import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';

async function main() {
  console.log('Connecting to DB at:', DB_URI);
  await mongoose.connect(DB_URI);
  console.log('Connected.');

  const count = await Employee.countDocuments();
  console.log('Total employees in DB:', count);

  const sample = await Employee.find({}).limit(20).select('fullName email employeeCode').lean();
  console.log('Sample employees:');
  console.log(JSON.stringify(sample, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
