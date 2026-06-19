// A single MCP server definition, transport-agnostic. Translated into each
// CLI's native config format when applied (see mcpTranslate.ts).
export type McpTransport = 'stdio' | 'http' | 'sse';

export type McpServer = {
  id: string;
  name: string; // key used in the CLI's native config
  transport: McpTransport;
  command?: string; // stdio
  args?: string[]; // stdio
  env?: Record<string, string>; // stdio
  url?: string; // http | sse
  enabled: boolean;
  description?: string;
};

export type McpFile = {
  servers: McpServer[];
};

export const DEFAULT_MCP: McpFile = { servers: [] };
