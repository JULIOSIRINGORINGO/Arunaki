const fs = require('fs');

function refactor() {
  const filePath = 'src/modules/workspace/workspace-runner.service.ts';
  let lines = fs.readFileSync(filePath, 'utf8').split('\n');

  // 1. Remove isRecapFillGoal and runRecapFillPipeline (Lines 97 to 334)
  // We can just find the indices based on known signatures to be safe against line number changes
  let startIdx1 = lines.findIndex(l => l.includes('private isRecapFillGoal('));
  if (startIdx1 > 0 && lines[startIdx1 - 1].includes('/** Recap-fill goal')) {
      startIdx1--;
  }
  let endIdx1 = lines.findIndex(l => l.includes('async syncWorkspacePhysicalFiles('));
  
  if (startIdx1 !== -1 && endIdx1 !== -1) {
    lines.splice(startIdx1, endIdx1 - startIdx1);
  }

  // 2. Remove state proxies (Lines 347 to 371 approx)
  let startIdx2 = lines.findIndex(l => l.includes('getRunState(workspaceId: string)'));
  let endIdx2 = lines.findIndex(l => l.includes('async *runWorkspaceAgentGenerator('));
  
  if (startIdx2 !== -1 && endIdx2 !== -1) {
    // Wait, addSteeringInput is the last proxy, we should stop after it.
    let addSteeringIdx = lines.findIndex(l => l.includes('addSteeringInput(workspaceId:'));
    if (addSteeringIdx !== -1) {
       endIdx2 = addSteeringIdx + 3; // addSteeringInput is 3 lines
       lines.splice(startIdx2, endIdx2 - startIdx2);
    }
  }

  // 3. Remove post run hooks
  let startIdx3 = lines.findIndex(l => l.includes('setImmediate(async () => {'));
  let endIdx3 = lines.findIndex((l, i) => i > startIdx3 && l.includes('return finalContent;'));
  
  if (startIdx3 !== -1 && endIdx3 !== -1) {
    const postRunCall = [
      '      this.postRunService.executePostRunHooks({',
      '        workspaceId,',
      '        userGoal,',
      '        finalContent,',
      '        runState,',
      '        modifiedFiles: modified.map((f) => f.filename),',
      '        messages,',
      '      });'
    ];
    // Remove the setImmediate block (endIdx3 is 'return finalContent;', we want to keep it)
    lines.splice(startIdx3, endIdx3 - startIdx3, ...postRunCall);
  }

  // 4. Update constructor
  let code = lines.join('\n');
  code = code.replace(/constructor\(/, 
`constructor(
    private readonly recapFillPipeline: RecapFillPipelineService,
    private readonly postRunService: WorkspacePostRunService,`);
    
  // 5. Replace RecapFill call in runWorkspaceAgentStream
  code = code.replace(/this\.isRecapFillGoal\(safeGoal\) &&/g, 
    'this.recapFillPipeline.isRecapFillGoal(safeGoal) &&');
    
  code = code.replace(/this\.runRecapFillPipeline/g, 
    'this.recapFillPipeline.runRecapFillPipeline');
    
  // Add imports
  const imports = `import { RecapFillPipelineService } from './services/recap-fill-pipeline.service';
import { WorkspacePostRunService } from './services/workspace-post-run.service';\n`;
  code = code.replace(/import \{ Injectable, Logger, Inject, forwardRef \} from '@nestjs\/common';/,
    `import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';\n` + imports);

  fs.writeFileSync(filePath, code);
  console.log('Refactoring applied correctly via script');
}

refactor();
