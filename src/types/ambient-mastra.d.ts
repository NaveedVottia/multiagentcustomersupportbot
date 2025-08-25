declare module "@mastra/core/tools" {
  export function createTool(config: any): any;
}

declare module "@mastra/core/workflows" {
  export function createWorkflow(config: any): any;
  export function createStep(config: any): any;
}

declare module "@mastra/mcp" {
  export class MCPClient {
    constructor(args: any);
    getToolsets(): Promise<Record<string, Record<string, any>>>;
  }
}


