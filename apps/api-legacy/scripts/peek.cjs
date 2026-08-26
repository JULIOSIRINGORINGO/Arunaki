const fs = require('fs');
const s = fs.readFileSync('apps/api/src/modules/interaction/excel-com.service.ts', 'utf8').replace(/\r\n/g, '\n');
const i = s.indexOf("case 'write_cell'");
console.log('start idx:', i);
// show tail after default case
const d = s.indexOf("default:");
console.log(JSON.stringify(s.substring(d, d + 300)));
