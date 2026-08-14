const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  
  const filterBlockMatch = content.match(/const (?:pendingRows|filteredRows) = allMapped\.filter[\s\S]*?return[^;]+;/);
  
  if (filterBlockMatch) {
    console.log(`\n--- ${file} ---`);
    console.log(filterBlockMatch[0]);
  }
});
