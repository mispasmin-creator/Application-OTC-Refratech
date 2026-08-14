const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/pages');
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (!file.endsWith('.jsx')) return;
  if (['Dashboard.jsx', 'Login.jsx', 'CreateIndent.jsx', 'UsersManagement.jsx'].includes(file)) return;
  
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Identify the Step Number N from "Status N"
  const stepMatch = content.match(/findIdx\('Status (\d+)'\)/);
  if (stepMatch) {
    const N = parseInt(stepMatch[1], 10);
    const nextN = N + 1;
    
    // We want to replace the try { ... } catch block in handleSubmit
    // We will look for:
    // try {
    //   const results = [];
    //   for (const u of updates) {
    // ... all the way to
    //   setSubmitting(false);
    // }
    
    const tryBlockRegex = /try\s*\{\s*const\s*results\s*=\s*\[\];[\s\S]*?finally\s*\{\s*setSubmitting\(false\);\s*\}\s*/;
    
    if (tryBlockRegex.test(content)) {
      const newTryBlock = `try {
      const payloadData = {};
      for (const u of updates) {
        const headerName = headers[u.col - 1];
        if (headerName) payloadData[headerName.toString().trim()] = u.val;
      }
      
      // Calculate Delay ${N}
      const plannedIdx = findIdx('Planned ${N}');
      let timeDelay = '';
      if (plannedIdx !== -1 && selectedItem?.rowData?.[plannedIdx]) {
        const pStr = selectedItem.rowData[plannedIdx].toString().trim();
        const pParts = pStr.split(' ')[0].split('/');
        if (pParts.length === 3) {
          const pDate = new Date(pParts[2], pParts[1] - 1, pParts[0]);
          if (!isNaN(pDate.getTime())) {
            const diffDays = Math.ceil((d.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
            timeDelay = diffDays.toString();
          }
        }
      }
      payloadData['Time Delay ${N}'] = timeDelay;
      
      // Calculate Planned ${nextN} (T + 2 days) if not final step
      ${N < 13 ? `
      const pNextDate = new Date();
      pNextDate.setDate(pNextDate.getDate() + 2);
      const formattedNextP = \`\${pad(pNextDate.getDate())}/\${pad(pNextDate.getMonth() + 1)}/\${pNextDate.getFullYear()} \${pad(pNextDate.getHours())}:\${pad(pNextDate.getMinutes())}:\${pad(pNextDate.getSeconds())}\`;
      payloadData['Planned ${nextN}'] = formattedNextP;
      ` : ''}

      const params = new URLSearchParams();
      params.append('sheetName', SHEET_NAME);
      params.append('action', 'updateByHeader');
      params.append('rowIndex', selectedItem.originalIndex);
      params.append('payloadData', JSON.stringify(payloadData));
      
      const r = await serialFetch(SCRIPT_URL, { method: 'POST', body: params }).then(res => res.json());
      
      if (r.success) {
        setMessage({ type: 'success', text: 'Details updated successfully!' });
        window.dispatchEvent(new Event('fms-updated'));
        setShowModal(false);
        fetchData(); // Refresh table
      } else {
        alert('Update failed: ' + (r.error || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert('Network error occurred.');
    } finally {
      setSubmitting(false);
    }
`;

      content = content.replace(tryBlockRegex, newTryBlock);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Replaced try-catch in ${file}`);
  }
});
