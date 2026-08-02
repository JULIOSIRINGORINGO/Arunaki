const fs = require('fs');
const files = [
  'e:/ARUNAKI/apps/web/src/components/layout/Sidebar.tsx',
  'e:/ARUNAKI/apps/web/src/components/workspace/FileTree.tsx',
  'e:/ARUNAKI/apps/web/src/components/workspace/FileUploadZone.tsx',
  'e:/ARUNAKI/apps/web/src/components/workspace/ScheduledReportsPanel.tsx',
  'e:/ARUNAKI/apps/web/src/pages/ChatPage.tsx',
  'e:/ARUNAKI/apps/web/src/pages/KnowledgePage.tsx',
  'e:/ARUNAKI/apps/web/src/pages/SettingsPage.tsx',
  'e:/ARUNAKI/apps/web/src/pages/WorkspaceDetailPage.tsx',
  'e:/ARUNAKI/apps/web/src/pages/WorkspacePage.tsx'
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, 'utf8');
  
  // Try to find the exact import of API_BASE from relative paths
  const regex = /import\s*\{\s*API_BASE\s*\}\s*from\s*['"](.*?)['"]/;
  const match = c.match(regex);
  if (match) {
    c = c.replace(regex, `import { API_BASE, apiFetch } from "${match[1]}"`);
    fs.writeFileSync(f, c);
    console.log('Fixed', f);
  } else {
    console.log('Could not find match in', f);
  }
}
console.log('Done');
