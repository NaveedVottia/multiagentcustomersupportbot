declare module '@mastra/core/agent' {
  export class Agent {
    constructor(config: any);
    name: string;
    description: string;
    instructions: string;
    model: any;
    tools: Record<string, any>;
    memory: any;
    // Try different method names that Mastra agents might use
    execute?(task: string, context?: any): Promise<any>;
    stream?(messages: any[]): Promise<any>;
    run?(input: any): Promise<any>;
    invoke?(input: any): Promise<any>;
  }
}

declare module '@mastra/core/mastra' {
  export class Mastra {
    constructor(config: any);
    registerAgent(agent: any): void;
    startServer(port: number): void;
    getAgentById(id: string): any;
    agents: Record<string, any>;
  }
}

declare module '@mastra/loggers' {
  export class PinoLogger {
    constructor(config: any);
    info(message: string): void;
    error(message: string): void;
  }
}

declare module '@mastra/libsql' {
  export class LibSQLStore {
    constructor(config: any);
    query(sql: string, params?: any[]): Promise<any>;
  }
}

declare module '@mastra/memory' {
  export class Memory {
    constructor();
    set(key: string, value: any): void;
    get(key: string): any;
  }
}

declare module '@mastra/core/workflows' {
  export function createWorkflow(config: any): any;
  export function createStep(config: any): any;
}

declare module '@mastra/core/tools' {
  export function createTool(config: any): any;
}
