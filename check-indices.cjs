const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  
  // Find all instances of `const planned...Idx = findIdx`
  const defs = content.match(/const\s+(planned|actual|status)\d*Idx\s*=\s*findIdx\('[^']+'\);/g);
  
  // Find all usages of `hasPlanned...` or `row[planned...Idx]`
  const filterBlockMatch = content.match(/const (?:pendingRows|filteredRows) = allMapped\.filter[\s\S]*?return[^;]+;/);
  
  if (filterBlockMatch) {
    console.log(`\n--- ${file} ---`);
    if (defs) {
      defs.forEach(d => console.log('  DEF:', d));
    } else {
      console.log('  NO DEFS FOUND');
    }
    
    // Extract the exact variables used in the filter block
    const usedVars = new Set();
    const matches = filterBlockMatch[0].match(/(planned|actual|status)\d*Idx/g);
    if (matches) {
      matches.forEach(m => usedVars.add(m));
    }
    console.log('  USED:', Array.from(usedVars).join(', '));
  }
});
