import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';

async function main() {
  console.log('Connecting to DB at:', DB_URI);
  await mongoose.connect(DB_URI);
  console.log('Connected.');

  // Scenario 1: Update "Dena Ahmed" to have the previous code "#EC00002-Dena Ahmed" in her transfer history.
  // This will test the historical transfer history resolution.
  const dena = await Employee.findOne({ fullName: /Dena Ahmed/i });
  if (dena) {
    dena.transferHistory = [{
      transferDate: new Date(),
      previousEmployeeCode: '#EC00002-Dena Ahmed',
      newEmployeeCode: dena.employeeCode,
      notes: 'Test transfer history resolution'
    }];
    await dena.save();
    console.log('Updated Dena Ahmed with historical code #EC00002-Dena Ahmed in transferHistory.');
  } else {
    console.log('Dena Ahmed not found in database.');
  }

  // Scenario 2: Update "yasmine Mosad" current code to "#CS0054-yasmine Mosaad" to test current code match.
  const yasmine = await Employee.findOne({ fullName: /yasmine Mosad/i });
  if (yasmine) {
    yasmine.employeeCode = '#CS0054-yasmine Mosaad';
    await yasmine.save();
    console.log('Updated yasmine Mosad current code to #CS0054-yasmine Mosaad.');
  } else {
    console.log('yasmine Mosad not found in database.');
  }

  await mongoose.disconnect();
}

main().catch(console.error);
