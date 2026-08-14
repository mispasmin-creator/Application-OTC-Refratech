const fs = require('fs');
const path = require('path');

const dirs = [path.join(__dirname, 'src/pages'), path.join(__dirname, 'src/components')];

dirs.forEach(dir => {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (!file.endsWith('.jsx')) return;
    
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Search for strict findIdx definitions
    const strictRegex1 = /const findIdx = \(name\) => headers\.findIndex\(h => h && h\.toString\(\)\.trim\(\) === name\);/g;
    if (strictRegex1.test(content)) {
      content = content.replace(strictRegex1, "const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());");
      modified = true;
    }
    
    const strictRegex2 = /const findIdx = \(name\) => headers\.findIndex\(h => h && h\.toString\(\)\.trim\(\) === name\.trim\(\)\);/g;
    if (strictRegex2.test(content)) {
      content = content.replace(strictRegex2, "const findIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.trim().toLowerCase());");
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed findIdx in ${file}`);
    }
  });
});
