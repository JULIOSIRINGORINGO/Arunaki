const fs = require('fs');
const path = require('path');

const filePath = path.resolve('apps/api/src/modules/tools/tools-provider.module.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const oldConstructor = `  constructor(
    @Inject(forwardRef(() => ToolRegistryService)) private readonly registry: ToolRegistryService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Optional() @Inject(forwardRef(() => CronService)) private readonly cronService?: CronService,
  ) {}`;

const newConstructor = `  constructor(
    @Inject(forwardRef(() => ToolRegistryService)) private readonly registry: ToolRegistryService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Optional() @Inject(forwardRef(() => CronService)) private readonly cronService?: CronService,
    @Inject(forwardRef(() => ContextQuarantine)) private readonly contextQuarantine: ContextQuarantine,
  ) {}`;

content = content.replace(oldConstructor, newConstructor);
fs.writeFileSync(filePath, content);
console.log('Patched constructor');
