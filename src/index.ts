#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, TokenProvider } from "./config.js";
import { ApiClient } from "./apiClient.js";
import { registerTools } from "./tools.js";
import { registerCrudTools } from "./crud.js";
import { registerPrompts } from "./prompts.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const tokens = new TokenProvider(config);
  const api = new ApiClient(config, tokens);

  const server = new McpServer(
    {
      name: "minimax-rac-server",
      version: "1.0.0",
    },
    {
      capabilities: { tools: {}, prompts: {} },
      instructions:
        "This MCP server provides access to the Minimax Slovenian accounting API (moj.minimax.si). Use the specialized tools for common invoicing workflows, and the generic minimax_list/get/create/update tools for full read/write access to all API resources (customers, items, invoices, orders, journals, documents, employees, stock, and more).",
    },
  );

  registerTools(server, api);
  registerCrudTools(server, api);
  registerPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only; stdout is reserved for the JSON-RPC stream.
  process.stderr.write("minimax-mcp-server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(
    `Fatal error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
