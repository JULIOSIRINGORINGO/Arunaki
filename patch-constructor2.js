const fs = require('fs');
const path = require('path');

const filePath = path.resolve('apps/api/src/modules/tools/tools-provider.module.ts');
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(
  /constructor\([\s\S]*?\)\s*\{/,
  `constructor(
    @Inject(forwardRef(() => ToolRegistryService)) private readonly registry: ToolRegistryService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Optional() @Inject(forwardRef(() => CronService)) private readonly cronService?: CronService,
    @Inject(forwardRef(() => ContextQuarantine)) private readonly contextQuarantine: ContextQuarantine,
  ) {`
);

fs.writeFileSync(filePath, content);
console.log('Patched constructor');
