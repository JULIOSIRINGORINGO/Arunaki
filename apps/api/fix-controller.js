const fs = require('fs');
let code = fs.readFileSync('src/modules/workspace/workspace.controller.ts', 'utf8');

code = code.replace(/import \{ WorkspaceRunnerService \} from '.\/workspace-runner.service.js';/,
  `import { WorkspaceRunnerService } from './workspace-runner.service.js';
import { WorkspaceRunStateService } from './services/workspace-run-state.service.js';`);

code = code.replace(/private readonly workspaceRunnerService: WorkspaceRunnerService,/,
  `private readonly workspaceRunnerService: WorkspaceRunnerService,
    private readonly workspaceRunStateService: WorkspaceRunStateService,`);
    
code = code.replace(/this\.workspaceRunnerService\.abortRun/g, 'this.workspaceRunStateService.abortRun');
code = code.replace(/this\.workspaceRunnerService\.addSteeringInput/g, 'this.workspaceRunStateService.addSteeringInput');
code = code.replace(/this\.workspaceRunnerService\.resolveApproval/g, 'this.workspaceRunStateService.resolveApproval');
code = code.replace(/this\.workspaceRunnerService\.getRunState/g, 'this.workspaceRunStateService.getRunState');
code = code.replace(/this\.workspaceRunnerService\.isRunning/g, 'this.workspaceRunStateService.isRunning');

fs.writeFileSync('src/modules/workspace/workspace.controller.ts', code);
console.log('Fixed controller');
