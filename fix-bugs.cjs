const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix slice offset from 5 to 6 to skip the header row correctly
  content = content.replace(/\.slice\(5\)\.map\(\(row, idx\) => \(\{\s*rowData: row,\s*originalIndex: idx \+ 6\s*\}\)\)/g, '.slice(6).map((row, idx) => ({ rowData: row, originalIndex: idx + 7 }))');

  // Remove the dark grey background from tab containers
  content = content.replace(/background:\s*['"]rgba\(15, 23, 42, 0\.6\)['"]/g, 'background: "var(--bg-card)"');
  
  // Or just transparent
  content = content.replace(/background:\s*['"]rgba\(15,\s*23,\s*42,\s*0\.6\)['"]/g, 'background: "transparent"');

  // Also remove dark background from select inputs if any
  content = content.replace(/backgroundColor:\s*['"]rgba\(15, 23, 42, 0\.9\)['"]/g, 'backgroundColor: "#fff"');
  
  // Some modals might have grey backgrounds on cancel buttons
  content = content.replace(/background:\s*['"]rgba\(255,255,255,0\.05\)['"]/g, 'background: "transparent", border: "1px solid var(--border-color)"');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${file}`);
});
