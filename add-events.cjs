const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('fms-updated')) return; // already added
  
  // Find where it says `fetchData(); // Refresh` or just `fetchData();` inside `handleSubmit`
  // Actually, let's just replace `fetchData();` with `fetchData(); window.dispatchEvent(new Event('fms-updated'));` globally for these pages, since `fetchData` is only called on mount and on refresh.
  // Wait, if we do it on mount, it dispatches an event. That's harmless!
  // But to be precise, let's replace `setMessage({ type: 'success', text:` because that's when a successful submit happens.
  
  content = content.replace(/(setMessage\(\{ type: 'success', [^}]+\}\);)/g, "$1\n        window.dispatchEvent(new Event('fms-updated'));");
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
});
