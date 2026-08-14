const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/pages');
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (!file.endsWith('.jsx')) return;
  if (['Dashboard.jsx', 'Login.jsx'].includes(file)) return;
  
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Handle CreateIndent separately (uses item.some instead of item.rowData.some)
  if (file === 'CreateIndent.jsx') {
    const searchStr = `const rows = indents.slice(1).filter(item => {
            if (!searchQuery) return true;
            return item.some(cell => `;
    const replacement = `const rows = indents.slice(1).filter(item => {
            const isRowEmpty = item.every(cell => !cell || cell.toString().trim() === '');
            if (isRowEmpty) return false;
            if (!searchQuery) return true;
            return item.some(cell => `;
    
    if (content.includes(searchStr)) {
      content = content.replace(searchStr, replacement);
      modified = true;
    }
  } else {
    const searchStr = `const rows = currentData.slice(1).filter(item => {
            if (!searchQuery) return true;
            return item.rowData.some(cell => `;
    const replacement = `const rows = currentData.slice(1).filter(item => {
            const isRowEmpty = item.rowData.every(cell => !cell || cell.toString().trim() === '');
            if (isRowEmpty) return false;
            if (!searchQuery) return true;
            return item.rowData.some(cell => `;
    
    if (content.includes(searchStr)) {
      content = content.replace(searchStr, replacement);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
