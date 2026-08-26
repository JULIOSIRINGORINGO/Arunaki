const fs = require('fs');
const path = require('path');

const servicePath = path.join('E:', 'JS', 'Arunika', 'apps', 'api', 'src', 'modules', 'interaction', 'excel-com.service.ts');
const compilerPath = path.join('E:', 'JS', 'Arunika', 'apps', 'api', 'src', 'modules', 'interaction', 'excel-com-compiler.ts');

let code = fs.readFileSync(servicePath, 'utf8');

const sIdx = code.indexOf('  private buildSheetActivate');
const eIdx = code.lastIndexOf('  }');

if (sIdx !== -1 && eIdx !== -1) {
  let compilerMethods = code.substring(sIdx, eIdx + 3);
  // change `private ` to `public ` in compilerMethods
  compilerMethods = compilerMethods.replace(/private buildSheetActivate/g, 'public buildSheetActivate');
  compilerMethods = compilerMethods.replace(/private buildPowerShellScript/g, 'public buildPowerShellScript');
  compilerMethods = compilerMethods.replace(/private buildActionBlock/g, 'public buildActionBlock');
  
  // also add buildFillTableColumnScript
  const fillStart = code.indexOf('      const rowBlocks =');
  const fillEnd = code.indexOf('      await writeFile(scriptPath');
  let fillCode = '';
  if (fillStart !== -1 && fillEnd !== -1) {
    fillCode = `
  public buildFillTableColumnScript(
    filePath: string,
    sheetName: string | undefined,
    date: string,
    rows: Array<{ label: string; value: any }>,
    details: string[] = []
  ): string {
    const esc = (s: string) => String(s).replace(/'/g, "''");
    const marshal = (raw: any): string => {
      if (typeof raw === 'number') return \`[double]\${raw}\`;
      if (typeof raw !== 'string') return \`'\${String(raw).replace(/'/g, "''")}'\`;
      const idm = raw.trim().match(/^([\\d.,\\s]+?)\\s*(RB|JT)?$/i);
      if (idm && /\\d/.test(idm[1])) {
        const mult =
          idm[2]?.toUpperCase() === 'JT' ? 1000000 : idm[2]?.toUpperCase() === 'RB' ? 1000 : 1;
        const n = Number(idm[1].replace(/[.\\s]/g, '').replace(',', '.'));
        if (!Number.isNaN(n)) return \`[double]\${n * mult}\`;
      }
      return \`'\${raw.replace(/'/g, "''")}'\`;
    };
${code.substring(fillStart, fillEnd).replace(/this\.buildSheetActivate/g, 'this.buildSheetActivate').trim()}
    return psScript;
  }
`;
  }
  
  const skelStart = code.indexOf('      const sheetLine =');
  const skelEnd = code.indexOf('      await writeFile(scriptPath');
  let skelCode = '';
  if (skelStart !== -1 && skelEnd !== -1) {
    skelCode = `
  public buildReadTableSkeletonScript(
    filePath: string,
    sheetName?: string,
  ): string {
${code.substring(skelStart, skelEnd).trim()}
    return ps;
  }
`;
  }

  const compilerFile = `import { ExcelAction } from './excel-com.service';

export class ExcelComCompiler {
${fillCode}
${skelCode}
${compilerMethods}
}
`;
  fs.writeFileSync(compilerPath, compilerFile, 'utf8');

  // Now remove from original service
  let newServiceCode = code.substring(0, sIdx) + '}\n';
  
  // replace buildPowerShellScript call
  newServiceCode = newServiceCode.replace(
    /const psScript = this\.buildPowerShellScript/g,
    'const psScript = this.compiler.buildPowerShellScript'
  );
  
  // replace fill script generation
  newServiceCode = newServiceCode.replace(
    /const esc = \(s: string\).*?const psScript = `[\s\S]*?`\s*;/m,
    `const psScript = this.compiler.buildFillTableColumnScript(filePath, sheetName, date, rows, details);`
  );
  // because the regex above might fail due to backticks, let's just do exact string replacement
  newServiceCode = newServiceCode.substring(0, fillStart - 32) + 
  `\n      const psScript = this.compiler.buildFillTableColumnScript(filePath, sheetName, date, rows, details);\n` + 
  code.substring(fillEnd);
  
  const newSkelStart = newServiceCode.indexOf('      const sheetLine =');
  const newSkelEnd = newServiceCode.indexOf('      await writeFile(scriptPath', newSkelStart);
  if (newSkelStart !== -1 && newSkelEnd !== -1) {
    newServiceCode = newServiceCode.substring(0, newSkelStart) +
    `const ps = this.compiler.buildReadTableSkeletonScript(filePath, sheetName);\n` +
    newServiceCode.substring(newSkelEnd);
  }
  
  // add compiler dependency
  newServiceCode = newServiceCode.replace(
    /private readonly fileLocks = new Map<string, Promise<unknown>>\(\);/,
    `private readonly fileLocks = new Map<string, Promise<unknown>>();
  private readonly compiler = new ExcelComCompiler();`
  );
  
  // add import
  newServiceCode = newServiceCode.replace(
    /import \{ tmpdir \} from 'os';/,
    `import { tmpdir } from 'os';\nimport { ExcelComCompiler } from './excel-com-compiler';`
  );

  fs.writeFileSync(servicePath, newServiceCode, 'utf8');
  console.log("Refactoring complete");
}
