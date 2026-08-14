const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'SiteReceived.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace result.data[4] with result.data[5]
content = content.replace(/const headers = result\.data\.length > 4 \? result\.data\[4\] : result\.data\[0\];/, "const headers = result.data.length > 5 ? result.data[5] : result.data[0];");

// Also replace the comment for clarity
content = content.replace(/\/\/ Use row 5 \(index 4\) as headers to match sheet exactly/, "// Use row 6 (index 5) as headers to match sheet exactly");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed SiteReceived.jsx');
