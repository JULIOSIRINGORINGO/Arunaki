const fs = require('fs');
const p = 'apps/api/src/modules/interaction/excel-com.service.ts';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const startMarker = "          case 'write_cell': {";
const start = s.indexOf(startMarker);
if (start < 0) throw new Error('start not found');
const endMarker = '        }\n      })\n      .join(' + String.raw`'\n'` + ');' + '\n';
const end = s.indexOf(endMarker, start);
if (end < 0) throw new Error('end not found');
const cases = s.slice(start, end); // includes switch-closing brace
s = s.slice(0, start) + s.slice(end + endMarker.length);
const method =
  '\n  private buildActionBlock(\n    act: ExcelAction,\n    filePath: string,\n  ): string {\n' +
  '    switch (act.action) {\n' + cases + '\n  }\n';
const lastBrace = s.lastIndexOf('}');
s = s.slice(0, lastBrace) + method + s.slice(lastBrace);
s = s.replace(
  'const block = this.buildActionBlock(act);',
  'const block = this.buildActionBlock(act, filePath);',
);
fs.writeFileSync(p, s.replace(/\n/g, '\r\n'));
console.log('OK');
