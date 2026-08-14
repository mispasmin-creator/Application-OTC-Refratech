const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/pages');
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (!file.endsWith('.jsx')) return;
  if (['Dashboard.jsx', 'Login.jsx', 'CreateIndent.jsx'].includes(file)) return;
  
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Remove the dark background from <select> elements in the modal
  const badSelectStyles = [
    `style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}`,
    `style={{ backgroundColor: 'var(--bg-dark)' }}`,
    `style={{ backgroundColor: 'var(--bg-darker)' }}`
  ];

  badSelectStyles.forEach(badStyle => {
    if (content.includes(badStyle)) {
      content = content.split(badStyle).join('');
      modified = true;
    }
  });
  
  // Also fix `<input ... style={{ opacity: 0.7 }}>` to remove inline style or replace with better disabled state if needed, but opacity 0.7 is fine.
  
  // Some selects might have `style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', ... }}`
  // Regex to remove ONLY backgroundColor from style props
  const bgRegex = /backgroundColor:\s*'rgba\(15,\s*23,\s*42,\s*0\.9\)'\s*,?/g;
  if (bgRegex.test(content)) {
    content = content.replace(bgRegex, '');
    modified = true;
  }
  
  // Fix empty style={{}} which might be left over
  content = content.replace(/style=\{\{\s*\}\}/g, '');

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
