const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/modules/CAAttendance/caAttendance.service.js',
  'src/core/leave/entitlement.js',
  'src/core/leave/workingDays.js',
  'src/modules/CAOvertime/caOtRequests.repository.js'
];

for (const relPath of filesToUpdate) {
  const filePath = path.join(__dirname, relPath);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Check if we need to add the import
    if (!content.includes('formatDateToIST') && content.includes('.slice(0, 10)')) {
      const importPath = relPath.startsWith('src/core/') 
        ? (relPath.includes('leave') ? '../utils/date.js' : './utils/date.js') 
        : '../../core/utils/date.js';
        
      const importStmt = `import { formatDateToIST } from "${importPath}";\n`;
      content = importStmt + content;
    }

    const regex2 = /String\(([^)]+)\)\.slice\(0,\s*10\)/g;
    content = content.replace(regex2, (match, p1) => {
      changed = true;
      return `formatDateToIST(${p1})`;
    });

    const regex3 = /value\.slice\(0,\s*10\)/g;
    content = content.replace(regex3, () => {
      changed = true;
      return `formatDateToIST(value)`;
    });

    const regex4 = /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/g;
    content = content.replace(regex4, () => {
      changed = true;
      return `formatDateToIST(new Date())`;
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${relPath}`);
    }
  }
}
