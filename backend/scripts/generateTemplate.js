import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PATH = path.join(__dirname, '..', 'HRMS_Template.xlsx');

async function generate() {
  console.log('--- Generating HRMS Data Import Template ---');

  const workbook = XLSX.utils.book_new();

  // 1. Instructions Sheet
  const instructions = [
    ['Sheet Name', 'Description', 'Mandatory Fields'],
    ['Branches', 'Define company locations', 'Governorate, City, Branch Name'],
    ['Departments', 'Top-level organizational units', 'Dept Name, Dept Code'],
    ['Teams', 'Sub-units within departments', 'Department Name, Team Name'],
    ['Positions', 'Job titles defined per department', 'Department Name, Title'],
    ['Employees', 'Main staff records', 'Full Name, Email, Employee Code, Role, Position, Department'],
    ['', '', ''],
    ['CRITICAL RULES:', '', ''],
    ['1. Role enumeration', 'Must be one of:', 'ADMIN, MANAGER, TEAM_LEADER, EMPLOYEE, HR_STAFF'],
    ['2. Date formats', 'Use YYYY-MM-DD', 'Example: 2024-01-15'],
    ['3. Unique fields', 'Email and Employee Code must be unique.', ''],
    ['4. Deletion', 'Uploading this file will WIPE the current database.', '']
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');

  // 2. Branches
  const branches = [['Governorate', 'City', 'Branch Name']];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(branches), 'Branches');

  // 3. Departments
  const departments = [['Dept Name', 'Dept Code', 'Head Title']];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(departments), 'Departments');

  // 4. Teams
  const teams = [['Department Name', 'Team Name', 'Description']];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(teams), 'Teams');

  // 5. Positions
  const positions = [['Department Name', 'Title', 'Level', 'Responsibility']];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(positions), 'Positions');

  // 6. Employees
  const employees = [[
    'Full Name', 'Full Name Arabic', 'Email', 'Employee Code', 
    'Role', 'Position', 'Department', 'Team', 'Date of Hire', 
    'Base Salary', 'National ID', 'ID Expiry Date'
  ]];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(employees), 'Employees');

  XLSX.writeFile(workbook, TEMPLATE_PATH);
  console.log(`✓ Template generated at: ${TEMPLATE_PATH}`);
}

generate().catch(console.error);
