const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  const plannedMatch = content.match(/const\s+planned[a-zA-Z0-9]*Idx\s*=\s*\d+;/);
  const actualMatch = content.match(/const\s+actual[a-zA-Z0-9]*Idx\s*=\s*\d+;/);
  
  if (plannedMatch || actualMatch) {
    console.log(file, '->', plannedMatch ? plannedMatch[0] : 'no planned', actualMatch ? actualMatch[0] : 'no actual');
  }
});
