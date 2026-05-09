import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";

const execAsync = promisify(exec);

const server = new Server(
  { name: "kali-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_command",
      description: "Execute any shell command on the Kali Linux system",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          timeout_seconds: { type: "number", description: "Timeout (default 60)" },
        },
        required: ["command"],
      },
    },
    {
      name: "nmap_scan",
      description: "Run an nmap scan against a target",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "IP address, hostname, or CIDR range" },
          flags: { type: "string", description: "nmap flags (default: -sV -sC --open)" },
        },
        required: ["target"],
      },
    },
    {
      name: "read_file",
      description: "Read a file from the Kali filesystem",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute file path" },
        },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: "Write content to a file on the Kali filesystem",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute file path" },
          content: { type: "string", description: "File content" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "list_directory",
      description: "List files and directories at a path",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path (default: /workspace)" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "run_command") {
      const timeout = (args.timeout_seconds ?? 60) * 1000;
      const { stdout, stderr } = await execAsync(String(args.command), {
        timeout,
        shell: "/bin/bash",
      });
      const out = [stdout, stderr ? `[stderr]\n${stderr}` : ""].filter(Boolean).join("\n");
      return { content: [{ type: "text", text: out || "(no output)" }] };
    }

    if (name === "nmap_scan") {
      const flags = args.flags ?? "-sV -sC --open";
      const { stdout, stderr } = await execAsync(
        `nmap ${flags} ${args.target}`,
        { timeout: 120_000, shell: "/bin/bash" }
      );
      const out = [stdout, stderr ? `[stderr]\n${stderr}` : ""].filter(Boolean).join("\n");
      return { content: [{ type: "text", text: out || "(no output)" }] };
    }

    if (name === "read_file") {
      const content = await fs.readFile(String(args.path), "utf-8");
      return { content: [{ type: "text", text: content }] };
    }

    if (name === "write_file") {
      await fs.writeFile(String(args.path), String(args.content), "utf-8");
      return { content: [{ type: "text", text: `Written: ${args.path}` }] };
    }

    if (name === "list_directory") {
      const dir = String(args.path ?? "/workspace");
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const listing = entries
        .map((e) => `${e.isDirectory() ? "d" : "-"}  ${e.name}`)
        .join("\n");
      return { content: [{ type: "text", text: listing || "(empty)" }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// HTTP server with SSE transport
const app = express();
app.use(express.json());

const transports = new Map();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);
  res.on("close", () => transports.delete(transport.sessionId));
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const transport = transports.get(req.query.sessionId);
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) => res.json({ status: "ok", server: "kali-mcp" }));

const PORT = process.env.MCP_PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[kali-mcp] MCP server listening on http://0.0.0.0:${PORT}`);
  console.log(`[kali-mcp] SSE endpoint: http://0.0.0.0:${PORT}/sse`);
});
