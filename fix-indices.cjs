const fs = require('fs');
const path = require('path');

const fixFile = (file, search, replace) => {
  const filePath = path.join(__dirname, 'src', 'pages', file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(search, replace);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${file}`);
};

fixFile('KilnTesting.jsx', 
  /const planned9Idx = findIdx\('Planned 9'\);\s*const actual9Idx = findIdx\('Actual 9'\);/g, 
  "const planned3Idx = findIdx('Planned 3');\n        const actual3Idx = findIdx('Actual 3');"
);

fixFile('ProfitLossSheet.jsx', 
  /const planned2Idx = findIdx\('Planned 2'\);\s*const actual2Idx = findIdx\('Actual 2'\);/g, 
  "const planned12Idx = findIdx('Planned12');\n        const actual12Idx = findIdx('Actual 12');" // note Planned12 vs Planned 12 ? let me check the sheet dump: 'Planned12'
);

fixFile('SettleAccountSupervisor.jsx', 
  /const planned8Idx = findIdx\('Planned 8'\);\s*const actual8Idx = findIdx\('Actual 8'\);/g, 
  "const planned11Idx = findIdx('Planned 11');\n        const actual11Idx = findIdx('Actual 11');"
);

fixFile('TakeQtyConfirmation.jsx', 
  /const planned9Idx = findIdx\('Planned 9'\);\s*const actual9Idx = findIdx\('Actual 9'\);/g, 
  "const planned8Idx = findIdx('Planned 8');\n        const actual8Idx = findIdx('Actual 8');"
);
