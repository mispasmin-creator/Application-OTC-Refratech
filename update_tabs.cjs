const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/pages');
const files = fs.readdirSync(dir);

const newTabs = `      {/* Tabs */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        <div style={{ display: 'inline-flex', background: 'var(--bg-dark)', padding: '0.25rem', borderRadius: '8px' }}>
          <button 
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '6px',
              background: activeTab === 'pending' ? 'var(--bg-darker)' : 'transparent',
              border: 'none',
              color: activeTab === 'pending' ? '#fff' : 'var(--text-muted)'
            }}
          >
            Pending ({Math.max(0, indents.length - 1)})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '6px',
              background: activeTab === 'history' ? 'var(--bg-darker)' : 'transparent',
              border: 'none',
              color: activeTab === 'history' ? '#fff' : 'var(--text-muted)'
            }}
          >
            History ({Math.max(0, historyIndents.length - 1)})
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="table-container">
        {fetching ? (`;

files.forEach(file => {
  if (!file.endsWith('.jsx')) return;
  // Skip pages that don't have this tab structure or are already updated
  if (['CreateIndent.jsx', 'Dashboard.jsx', 'Login.jsx', 'UsersManagement.jsx', 'PoConfirmation.jsx', 'SiteReceived.jsx'].includes(file)) return;
  
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find the old table section header
  // Note: Since each page has different text in the h2 tag (e.g. 'Pending KILN Testing' vs 'Pending Sound Test'),
  // we need a regex that captures everything from {/* Table Section */} up to {fetching ? (
  const regex = /\{\/\*\s*Table Section\s*\*\/\}\s*<div className="table-container">\s*<div style=\{\{ display: 'flex'[\s\S]*?<\/div>\s*<\/div>\s*\{fetching \? \(/;
  
  if (regex.test(content)) {
    console.log(`Fixing ${file}...`);
    content = content.replace(regex, newTabs);
    fs.writeFileSync(filePath, content, 'utf8');
  } else {
    console.log(`Skipped ${file} (no match)`);
  }
});
