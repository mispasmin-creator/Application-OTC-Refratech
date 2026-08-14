const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/pages');
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (!file.endsWith('.jsx')) return;
  // Skip pages that don't have tables
  if (['Dashboard.jsx', 'Login.jsx'].includes(file)) return;
  
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  let modified = false;

  // 1. Inject Search import
  if (content.includes('lucide-react') && !content.includes('Search,')) {
    content = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/, (match, p1) => {
      return `import { Search, ${p1.trim()} } from 'lucide-react';`;
    });
    modified = true;
  }

  // 2. Inject State
  if (!content.includes('searchQuery')) {
    // Look for fetching state to inject near it
    if (content.includes('const [fetching, setFetching] = useState(true);')) {
      content = content.replace(/const \[fetching, setFetching\] = useState\(true\);/, `const [fetching, setFetching] = useState(true);\n  const [searchQuery, setSearchQuery] = useState('');`);
      modified = true;
    }
  }

  // 3. Inject Filter Logic
  if (!content.includes('searchQuery.toLowerCase()')) {
    // If it's a page that uses currentData.slice(1) (like POConfirmation, KilnTesting, etc.)
    if (content.includes('const rows = currentData.slice(1);')) {
      content = content.replace(/const rows = currentData\.slice\(1\);/, `const rows = currentData.slice(1).filter(item => {
            if (!searchQuery) return true;
            return item.rowData.some(cell => 
              cell && cell.toString().toLowerCase().includes(searchQuery.toLowerCase())
            );
          });`);
      modified = true;
    }
    // Handle CreateIndent separately
    else if (file === 'CreateIndent.jsx' && content.includes('const rows = indents.slice(1);')) {
      content = content.replace(/const rows = indents\.slice\(1\);/, `const rows = indents.slice(1).filter(item => {
            if (!searchQuery) return true;
            return item.rowData.some(cell => 
              cell && cell.toString().toLowerCase().includes(searchQuery.toLowerCase())
            );
          });`);
      modified = true;
    }
  }

  // 4. Inject Search UI
  const searchUI = `      {/* Table Section */}
      <div className="table-container">
        <div style={{ position: 'relative', width: '100%', maxWidth: '100%', marginBottom: '1.5rem', display: 'flex' }}>
          <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by PO Number, Application Number, Firm Name, or any keyword..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1rem', transition: 'all 0.2s ease', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>`;

  if (!content.includes('placeholder="Search by PO') && content.includes('className="table-container"')) {
    content = content.replace(/\{\/\*\s*Table Section\s*\*\/\}\s*<div className="table-container">/, searchUI);
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
