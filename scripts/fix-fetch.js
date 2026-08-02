const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('e:/ARUNAKI/apps/web/src');
let updatedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  if (content.includes('fetch(') || content.includes('fetchEventSource(')) {
    // 1. Add apiFetch to import from "@/lib/api"
    if (content.includes('import { API_BASE } from "@/lib/api"')) {
      content = content.replace('import { API_BASE } from "@/lib/api"', 'import { API_BASE, apiFetch } from "@/lib/api"');
      changed = true;
    } else if (content.includes('import { API_BASE, apiFetch } from "@/lib/api"')) {
      // already there
    } else if (content.includes('import {') && content.includes('} from "@/lib/api"')) {
      if (!content.includes('apiFetch')) {
        content = content.replace('} from "@/lib/api"', ', apiFetch } from "@/lib/api"');
        changed = true;
      }
    }
    
    // 2. Replace fetch( with apiFetch(
    const newContent = content.replace(/\bfetch\(/g, 'apiFetch(');
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
    
    // 3. Add fetch: apiFetch to fetchEventSource options
    if (content.includes('fetchEventSource(')) {
      // We look for fetchEventSource(..., {
      // and inject `fetch: apiFetch,` right after `{`
      const fEventRegex = /fetchEventSource\(([^,]+),\s*\{/g;
      const replacedFEvent = content.replace(fEventRegex, 'fetchEventSource($1, {\n        fetch: apiFetch,');
      if (replacedFEvent !== content) {
        content = replacedFEvent;
        changed = true;
      }
    }
  }
  
  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
    updatedCount++;
  }
}

console.log(`Done! Updated ${updatedCount} files.`);
