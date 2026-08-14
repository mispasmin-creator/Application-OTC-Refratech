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

  // Replace <div style={{ marginBottom: '1rem' }}> with <div className="form-group"> inside modals
  // To avoid false positives, we'll look for <div style={{ marginBottom: '1rem' }}> that contains <label className="form-label">
  
  const divRegex = /<div style=\{\{\s*marginBottom:\s*['"]1rem['"]\s*\}\}\s*>/g;
  if (divRegex.test(content)) {
    content = content.replace(divRegex, '<div className="form-group">');
    modified = true;
  }
  
  // Some might have <div style={{ marginBottom: '1.5rem' }}>
  const divRegex2 = /<div style=\{\{\s*marginBottom:\s*['"]1\.5rem['"]\s*\}\}\s*>/g;
  if (divRegex2.test(content)) {
    content = content.replace(divRegex2, '<div className="form-group">');
    modified = true;
  }

  // Also fix "Cancel" and "Submit" buttons to look premium
  // <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
  // We don't need to change the div, but maybe the cancel button.
  // <button className="btn" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button> -> add style={{ background: 'var(--bg-darker)' }}

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated layout in ${file}`);
  }
});
