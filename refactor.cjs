const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

if (!fs.existsSync(pagesDir)) {
  console.error("Pages directory not found!");
  process.exit(1);
}

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove max-height and overflow-y nested scrolling
  content = content.replace(/<div style=\{\{\s*maxHeight:\s*['"]600px['"],\s*overflowY:\s*['"]auto['"]\s*\}\}>/g, '<div>');
  
  // Replace table inline styles
  content = content.replace(/<table style=\{\{\s*width:\s*['"]100%['"],\s*borderCollapse:\s*['"]collapse['"],\s*minWidth:\s*['"]1500px['"]\s*\}\}>/g, '<table className="custom-table">');
  
  // Replace table container styles
  content = content.replace(/className="glass-panel"\s+style=\{\{\s*padding:\s*['"]2rem['"],\s*borderRadius:\s*['"]12px['"],\s*overflowX:\s*['"]auto['"],?\s*WebkitOverflowScrolling:\s*['"]touch['"]\s*\}\}/g, 'className="table-container"');
  content = content.replace(/className="glass-panel"\s+style=\{\{\s*padding:\s*['"]2rem['"],\s*borderRadius:\s*['"]12px['"],\s*overflowX:\s*['"]auto['"]\s*\}\}/g, 'className="table-container"');

  // Replace TH sticky action
  content = content.replace(/<th style=\{\{\s*padding:\s*['"]1rem['"],\s*textAlign:\s*['"]left['"],\s*color:\s*['"]var\(--text-muted\)['"],\s*fontWeight:\s*500,\s*whiteSpace:\s*['"]nowrap['"],\s*position:\s*['"]sticky['"],\s*top:\s*0,\s*left:\s*0,\s*background:\s*['"]var\(--bg-darker\)['"],\s*zIndex:\s*20\s*\}\}>/g, '<th className="sticky-action">');
  
  // Replace standard TH
  content = content.replace(/<th key=\{idx\} style=\{\{\s*padding:\s*['"]1rem['"],\s*textAlign:\s*['"]left['"],\s*color:\s*['"]var\(--text-muted\)['"],\s*fontWeight:\s*500,\s*whiteSpace:\s*['"]nowrap['"],\s*position:\s*['"]sticky['"],\s*top:\s*0,\s*background:\s*['"]var\(--bg-darker\)['"],\s*zIndex:\s*15\s*\}\}>/g, '<th key={idx}>');

  // Replace TD sticky action
  content = content.replace(/<td style=\{\{\s*padding:\s*['"]1rem['"],\s*whiteSpace:\s*['"]nowrap['"],\s*position:\s*['"]sticky['"],\s*left:\s*0,\s*background:\s*['"]var\(--bg-darker\)['"],\s*zIndex:\s*10\s*\}\}>/g, '<td className="sticky-action">');
  content = content.replace(/<td style=\{\{\s*padding:\s*['"]1rem['"],\s*display:\s*['"]flex['"],\s*gap:\s*['"]0\.5rem['"],\s*position:\s*['"]sticky['"],\s*left:\s*0,\s*background:\s*['"]var\(--bg-darker\)['"],\s*zIndex:\s*10\s*\}\}>/g, '<td className="sticky-action" style={{ display: "flex", gap: "0.5rem" }}>');

  // Standard TD
  content = content.replace(/<td key=\{idx\} style=\{\{\s*padding:\s*['"]1rem['"],\s*whiteSpace:\s*['"]nowrap['"]\s*\}\}>/g, '<td key={idx}>');

  // Replace inline hover styles in <style>
  content = content.replace(/tbody tr:hover td \{\s*background: rgba\(255,\s*255,\s*255,\s*0\.05\);\s*\}/g, '');
  content = content.replace(/tbody tr:hover \{\s*background: rgba\(255,\s*255,\s*255,\s*0\.02\);\s*\}/g, '');
  
  // Modals
  content = content.replace(/<div style=\{\{\s*position:\s*['"]fixed['"],\s*inset:\s*0,\s*backgroundColor:\s*['"]rgba\(0,0,0,0\.6\)['"],\s*backdropFilter:\s*['"]blur\(4px\)['"],\s*display:\s*['"]flex['"],\s*alignItems:\s*['"]center['"],\s*justifyContent:\s*['"]center['"],\s*zIndex:\s*50\s*\}\}>/g, '<div className="modal-overlay">');
  
  // CreateIndent Modal
  content = content.replace(/<div style=\{\{\s*position:\s*['"]fixed['"],\s*top:\s*0,\s*left:\s*0,\s*width:\s*['"]100vw['"],\s*height:\s*['"]100vh['"],\s*background:\s*['"]rgba\(0, 0, 0, 0\.5\)['"],\s*backdropFilter:\s*['"]blur\(6px\)['"],\s*display:\s*['"]flex['"],\s*justifyContent:\s*['"]center['"],\s*alignItems:\s*['"]center['"],\s*zIndex:\s*1000,\s*padding:\s*['"]1rem['"],\s*overflow:\s*['"]hidden['"]\s*\}\}>/g, '<div className="modal-overlay">');

  content = content.replace(/<div className="glass-panel animate-fade-in" style=\{\{\s*padding:\s*['"]2rem['"],\s*borderRadius:\s*['"]12px['"],\s*minWidth:\s*['"]400px['"],\s*maxWidth:\s*['"]90%['"],\s*border:\s*['"]1px solid var\(--border-color\)['"]\s*\}\}>/g, '<div className="modal-card animate-fade-in" style={{ minWidth: "400px", padding: "2rem" }}>');

  // CreateIndent modal content
  content = content.replace(/<div className="glass-panel animate-fade-in" style=\{\{\s*width:\s*['"]100%['"],\s*maxWidth:\s*['"]900px['"],\s*maxHeight:\s*['"]90vh['"],\s*overflowY:\s*['"]auto['"],\s*padding:\s*['"]2\.5rem['"],\s*borderRadius:\s*['"]24px['"],\s*position:\s*['"]relative['"],\s*background:\s*['"]var\(--bg-card\)['"],\s*boxShadow:\s*['"]0 25px 50px -12px rgba\(0, 0, 0, 0\.25\)['"]\s*\}\}>/g, '<div className="modal-card animate-fade-in">');

  // Write changes
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
});
