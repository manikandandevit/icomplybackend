const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filesToUpdate = [
  'src/modules/CAOvertime/caOtRequests.constants.js',
  'src/modules/CALeaveRequests/caLeaveRequests.constants.js',
  'src/modules/CAHolidays/caHolidays.constants.js',
  'src/modules/CAEmployees/caEmployees.constants.js',
  'src/modules/CALeaveRevokes/caLeaveRevokes.constants.js',
  'src/modules/CAAttendance/caAttendance.constants.js',
  'src/modules/CAEstablishments/caEstablishments.constants.js'
];

for (const relPath of filesToUpdate) {
  const filePath = path.join(__dirname, relPath);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Check if we need to add the import
    if (!content.includes('formatDateToIST') && content.includes('.slice(0, 10)')) {
      const importStmt = `import { formatDateToIST } from "../../core/utils/date.js";\n`;
      content = importStmt + content;
    }

    // Replace various patterns of slice(0, 10)
    
    // Pattern 1: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date || "").slice(0, 10)
    const regex1 = /row\.([a-zA-Z_]+)\s+instanceof\s+Date\s*\?\s*row\.\1\.toISOString\(\)\.slice\(0,\s*10\)\s*:\s*String\(row\.\1\s*\|\|\s*["']["']\)\.slice\(0,\s*10\)/g;
    content = content.replace(regex1, (match, p1) => {
      changed = true;
      return `formatDateToIST(row.${p1})`;
    });

    // Pattern 2: String(value).slice(0, 10) or String(row.some_date || "").slice(0, 10)
    const regex2 = /String\(([^)]+)\)\.slice\(0,\s*10\)/g;
    content = content.replace(regex2, (match, p1) => {
      // Don't replace if it's already formatting a string explicitly for something else, but for dates it's fine
      changed = true;
      return `formatDateToIST(${p1})`;
    });

    // Pattern 3: value.slice(0, 10)
    const regex3 = /value\.slice\(0,\s*10\)/g;
    content = content.replace(regex3, () => {
      changed = true;
      return `formatDateToIST(value)`;
    });

    // Pattern 4: dateStr.slice(0, 10) -> not present in backend
    
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${relPath}`);
    }
  }
}
