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

  // Regex to remove ONLY the backgroundColor prop from style attributes
  const regexes = [
    /backgroundColor:\s*'#fff'\s*,?/g,
    /backgroundColor:\s*["']#fff["']\s*,?/g,
    /backgroundColor:\s*'rgba\(15,\s*23,\s*42,\s*0\.5\)'\s*,?/g,
    /backgroundColor:\s*'rgba\(15,\s*23,\s*42,\s*0\.9\)'\s*,?/g
  ];

  regexes.forEach(regex => {
    if (regex.test(content)) {
      content = content.replace(regex, '');
      modified = true;
    }
  });

  // Clean up any empty styles like style={{ }} or style={{  }}
  if (content.includes('style={{ }}') || content.includes('style={{  }}') || content.includes('style={{   }}')) {
    content = content.replace(/style=\{\{\s*\}\}/g, '');
    modified = true;
  }

  // Also replace inline width: '100%' on elements that use form-input because we moved it to CSS
  const widthRegex = /width:\s*['"]100%['"]\s*,?/g;
  if (widthRegex.test(content)) {
    content = content.replace(widthRegex, '');
    modified = true;
  }
  
  // Clean empty styles again
  content = content.replace(/style=\{\{\s*\}\}/g, '');

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
