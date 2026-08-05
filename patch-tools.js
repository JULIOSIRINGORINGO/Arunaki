const fs = require('fs');
const path = require('path');

const filePath = path.resolve('apps/api/src/modules/tools/tools-provider.module.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add ContextQuarantine imports
content = content.replace(
  "import { SubAgentRunnerService } from '../chat/sub-agent-runner.service.js';",
  "import { SubAgentRunnerService } from '../chat/sub-agent-runner.service.js';\nimport { ContextModule } from '../ai/context/context.module.js';\nimport { ContextQuarantine } from '../ai/context/context-quarantine.service.js';"
);

content = content.replace(
  "forwardRef(() => CronModule),\n  ],",
  "forwardRef(() => CronModule),\n    ContextModule,\n  ],"
);

content = content.replace(
  "@Optional() @Inject(forwardRef(() => CronService)) private readonly cronService?: CronService,\n  ) {}",
  "@Optional() @Inject(forwardRef(() => CronService)) private readonly cronService?: CronService,\n    @Inject(forwardRef(() => ContextQuarantine)) private readonly contextQuarantine: ContextQuarantine,\n  ) {}"
);

// 2. Add mutating: true
const mutatingTools = [
  'write_workspace_file',
  'delete_workspace_file',
  'rename_workspace_file',
  'edit_workspace_file',
  'create_skill',
  'update_skill',
  'delete_skill',
  'save_memory',
  'delete_memory',
  'desktop_excel_edit',
  'desktop_word_type',
  'desktop_word_format',
  'desktop_send_keys',
  'schedule_cron_job',
  'delete_cron_job'
];

for (const tool of mutatingTools) {
  const regex = new RegExp(`name: '${tool}',\\s+displayName:`, 'g');
  content = content.replace(regex, `name: '${tool}',\n        mutating: true,\n        displayName:`);
}

// 3. Sanitize web_search
content = content.replace(
  "handler: (args) =>\n          this.webSearchTool.searchWeb(args.query, args.searchDepth),",
  `handler: async (args) => {
          const result = await this.webSearchTool.searchWeb(args.query, args.searchDepth);
          if (result.status === 'success' && result.preview) {
            result.preview = this.contextQuarantine.sanitizeText(result.preview, 'web-search');
          }
          return result;
        },`
);

// 4. Sanitize browser_get_content
content = content.replace(
  "const content = await this.browserInteraction.getContent(args.workspaceId);",
  "let content = await this.browserInteraction.getContent(args.workspaceId);\n            content = this.contextQuarantine.sanitizeText(content, 'browser-content');"
);

fs.writeFileSync(filePath, content);
console.log('Patched tools-provider.module.ts');
