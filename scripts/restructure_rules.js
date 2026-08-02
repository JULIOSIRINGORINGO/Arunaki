const fs = require('fs');
const file = 'e:/ARUNAKI/apps/api/src/prompts/rules.md';
let content = fs.readFileSync(file, 'utf8');

// Extract parts
const headerMatch = content.match(/# Core Rules[\s\S]*?These are mandatory\. Breaking them means the task has failed\.\n\n---\n/);
const header = headerMatch[0];
content = content.replace(header, '');

// Extract Section 5
const sec5Match = content.match(/## 5\. Safety\n\n([\s\S]*?)\n---\n/);
const sec5 = sec5Match[1];
content = content.replace(sec5Match[0], '');

// Extract Section 10
const sec10Match = content.match(/## 10\. Contextual Pronouns & File Reference Resolution\n\n([\s\S]*)$/);
const sec10 = sec10Match ? sec10Match[1] : '';
if (sec10Match) {
  content = content.replace(sec10Match[0], '');
}

// Extract old section 7.4 (now 6.4 -> will become 7.4 again after renumbering)
// Wait, we can just replace the specific texts in the content directly.
let new7_4_opening = `### 7.4 Visible Application Interaction\n\nWhen operating applications visible on screen (desktop or browser), refer to the **Interactive** category in the tool list above for available tools.\n\n`;

// First, fix the 7.4 section contents
content = content.replace(/### 7\.4 Visible Application Interaction\n\nWhen operating applications visible on screen \(desktop or browser\):\n\n\*\*Web \(Browser Interaction\):\*\*\n(?:- `browser_.*?\n)+/, new7_4_opening);
content = content.replace(/\*\*Desktop \(Native Apps\):\*\*\n(?:- `desktop_.*?\n)+/, '');

// Now we have the remaining content (Sections 1-4, 6-9, minus 5, 10, and trimmed 7.4)
// Let's prepend the new Safety section as Section 1
let newSafetySection = `## 1. Safety\n\n${sec5}\n${sec10.trim()}\n\n---\n\n`;

// Then renumber the remaining sections:
// They are currently 1, 2, 3, 4, 6, 7, 8, 9
// They should become 2, 3, 4, 5, 6, 7, 8, 9
// We can just find all `## \d+\. ` and increment their numbers.
let newContent = newSafetySection + content;

// Renumbering logic:
let sectionCounter = 2; // We already added ## 1. Safety
newContent = newContent.replace(/## \d+\. /g, () => {
  return `## ${sectionCounter++}. `;
});

// also fix sub-sections inside section 7: 
// The old section 7 is now section 7 (it was 7, shifted by 1 safety section, wait!)
// Old layout: 1, 2, 3, 4, [5 was safety], 6, 7, 8, 9
// After moving 5 to 1:
// 1. Safety
// 2. Tooling (old 1)
// 3. Tool Call Style (old 2)
// 4. Execution Bias (old 3)
// 5. Self-Correction (old 4)
// 6. Workspace (old 6)
// 7. Interaction Guide (old 7)
// 8. Error Handling (old 8)
// 9. Output Contract (old 9)
// It works perfectly because 5 is removed and 1-4 shift to 2-5, 6-9 shift to 6-9 (they stay the same because old 5 is now 1, 6 is still 6!).
// Wait, if old 6 becomes 6, it doesn't change its number. Let's check:
// Old sections:
// 1 -> 2
// 2 -> 3
// 3 -> 4
// 4 -> 5
// 6 -> 6
// 7 -> 7
// 8 -> 8
// 9 -> 9
// My sectionCounter just goes 2,3,4,5,6,7,8,9. This will renumber them perfectly.

// Since 7 remains 7, the subsections ### 7.1 etc don't need renumbering!

fs.writeFileSync(file, header + newContent);
console.log('Restructuring complete');
