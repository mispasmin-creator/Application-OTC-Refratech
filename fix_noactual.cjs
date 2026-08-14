const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/pages');
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (!file.endsWith('.jsx')) return;
  
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // We are looking for lines like:
  // const noActual5 = actual5Idx === -1 || row[actual5Idx] === undefined || row[actual5Idx] === null || row[actual5Idx].toString().trim() !== '';
  // and we want to change !== to === at the end of the line.

  const regex = /(const noActual\d+\s*=\s*.*?\.toString\(\)\.trim\(\)\s*)!==(\s*'';)/g;
  
  if (regex.test(content)) {
    content = content.replace(regex, "$1===$2");
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed noActual logic in ${file}`);
  }
});
