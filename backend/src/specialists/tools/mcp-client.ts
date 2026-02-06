/**
 * MCP Client
 * Model Context Protocol client for connecting to MCP servers
 * 
 * Provides standardized tool access via MCP protocol
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

interface MCPServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

// MCP server configurations
const MCP_SERVERS: Record<string, MCPServer> = {
  'brave-search': {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-brave-search'],
    env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || '' },
  },
  'fetch': {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-fetch'],
  },
  'filesystem': {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-filesystem', '/tmp'],
  },
};

// Cache for connected clients
const clientCache: Map<string, Client> = new Map();

/**
 * Connect to an MCP server
 */
export async function connectToServer(serverName: string): Promise<Client | null> {
  // Check cache first
  if (clientCache.has(serverName)) {
    return clientCache.get(serverName)!;
  }
  
  const serverConfig = MCP_SERVERS[serverName];
  if (!serverConfig) {
    console.error(`[MCP] Unknown server: ${serverName}`);
    return null;
  }
  
  try {
    console.log(`[MCP] Connecting to ${serverName}...`);
    
    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args,
      env: { ...process.env, ...serverConfig.env },
    });
    
    const client = new Client({
      name: 'hivemind-protocol',
      version: '1.0.0',
    }, {
      capabilities: {},
    });
    
    await client.connect(transport);
    
    clientCache.set(serverName, client);
    console.log(`[MCP] Connected to ${serverName}`);
    
    return client;
  } catch (error: any) {
    console.error(`[MCP] Failed to connect to ${serverName}:`, error.message);
    return null;
  }
}

/**
 * List available tools from an MCP server
 */
export async function listTools(serverName: string): Promise<MCPTool[]> {
  const client = await connectToServer(serverName);
  if (!client) return [];
  
  try {
    const result = await client.listTools();
    return result.tools.map(t => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema,
    }));
  } catch (error: any) {
    console.error(`[MCP] Failed to list tools from ${serverName}:`, error.message);
    return [];
  }
}

/**
 * Call a tool on an MCP server
 */
export async function callTool(
  serverName: string, 
  toolName: string, 
  args: Record<string, any>
): Promise<any> {
  const client = await connectToServer(serverName);
  if (!client) {
    throw new Error(`Could not connect to MCP server: ${serverName}`);
  }
  
  try {
    console.log(`[MCP] Calling ${serverName}/${toolName} with:`, args);
    
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });
    
    // Extract text content from result
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
      
      // Try to parse as JSON if it looks like JSON
      if (textContent.startsWith('{') || textContent.startsWith('[')) {
        try {
          return JSON.parse(textContent);
        } catch {
          return textContent;
        }
      }
      return textContent;
    }
    
    return result;
  } catch (error: any) {
    console.error(`[MCP] Tool call failed:`, error.message);
    throw error;
  }
}

/**
 * Brave Search via MCP
 */
export async function braveSearch(query: string, count: number = 5): Promise<any> {
  try {
    return await callTool('brave-search', 'brave_web_search', { 
      query, 
      count: Math.min(count, 20) 
    });
  } catch (error: any) {
    console.log('[MCP] Brave search failed, using fallback');
    return null;
  }
}

/**
 * Fetch URL content via MCP
 */
export async function fetchUrl(url: string, maxLength?: number): Promise<string | null> {
  try {
    return await callTool('fetch', 'fetch', { 
      url,
      max_length: maxLength || 50000,
    });
  } catch (error: any) {
    console.log('[MCP] Fetch failed:', error.message);
    return null;
  }
}

/**
 * Close all MCP connections
 */
export async function closeAll(): Promise<void> {
  for (const [name, client] of clientCache) {
    try {
      await client.close();
      console.log(`[MCP] Closed connection to ${name}`);
    } catch (error) {
      // Ignore close errors
    }
  }
  clientCache.clear();
}

export default {
  connectToServer,
  listTools,
  callTool,
  braveSearch,
  fetchUrl,
  closeAll,
};
