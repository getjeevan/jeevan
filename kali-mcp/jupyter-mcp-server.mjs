import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import https from "https";
import { WebSocket } from "ws";
import { randomUUID } from "crypto";

const JUPYTER_URL = (process.env.JUPYTER_URL || "https://65.95.15.70:32225").replace(/\/$/, "");
const JUPYTER_TOKEN = process.env.JUPYTER_TOKEN || "";
const MCP_PORT = process.env.JUPYTER_MCP_PORT || 8081;

// Shared HTTPS agent — ignores self-signed certs on on-prem Jupyter
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function authHeaders() {
  return JUPYTER_TOKEN
    ? { Authorization: `Token ${JUPYTER_TOKEN}` }
    : {};
}

async function jupyterFetch(path, options = {}) {
  const url = `${JUPYTER_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
    // node 20 fetch doesn't honour NODE_TLS_REJECT_UNAUTHORIZED — use dispatcher workaround
    dispatcher: undefined,
  });

  // Fallback: use https.request for SSL bypass
  return res;
}

// Low-level HTTPS request that bypasses self-signed cert
function httpsRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${JUPYTER_URL}${path}`);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: `${urlObj.pathname}${urlObj.search}`,
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      agent: httpsAgent,
    };

    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, text, json: () => JSON.parse(text) });
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Execute code in a temporary kernel and return output
async function executeCode(code, kernelName = "python3") {
  // 1. Start a kernel
  const kernelRes = await httpsRequest("POST", "/api/kernels", { name: kernelName });
  if (kernelRes.status !== 201) {
    throw new Error(`Failed to start kernel: ${kernelRes.text}`);
  }
  const kernel = kernelRes.json();
  const kernelId = kernel.id;

  try {
    // 2. Connect via WebSocket
    const wsUrl = JUPYTER_URL.replace(/^https/, "wss").replace(/^http/, "ws");
    const output = await new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `${wsUrl}/api/kernels/${kernelId}/channels`,
        {
          headers: authHeaders(),
          rejectUnauthorized: false,
        }
      );

      const msgId = randomUUID();
      const results = [];
      let timer;

      ws.on("open", () => {
        ws.send(JSON.stringify({
          header: { msg_id: msgId, msg_type: "execute_request", version: "5.3" },
          parent_header: {},
          metadata: {},
          content: { code, silent: false, store_history: false, allow_stdin: false },
          channel: "shell",
        }));
        // Timeout after 30s
        timer = setTimeout(() => {
          ws.close();
          resolve(results.join("\n") || "(timeout — no output)");
        }, 30000);
      });

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.parent_header?.msg_id !== msgId) return;

          const { msg_type, content } = msg;
          if (msg_type === "stream") results.push(content.text);
          if (msg_type === "execute_result") results.push(content.data?.["text/plain"] || "");
          if (msg_type === "error") results.push(content.traceback?.join("\n") || content.ename);
          if (msg_type === "execute_reply") {
            clearTimeout(timer);
            ws.close();
            resolve(results.join("") || "(no output)");
          }
        } catch (_) {}
      });

      ws.on("error", (e) => { clearTimeout(timer); reject(e); });
    });

    return output;
  } finally {
    // 3. Shut down the kernel
    await httpsRequest("DELETE", `/api/kernels/${kernelId}`, null);
  }
}

// ---------- MCP Server ----------

const server = new Server(
  { name: "jupyter-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "jupyter_list_contents",
      description: "List notebooks and files in the Jupyter server",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path (default: root)" },
        },
      },
    },
    {
      name: "jupyter_read_notebook",
      description: "Read a Jupyter notebook and return its cells",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Notebook path (e.g. folder/notebook.ipynb)" },
        },
        required: ["path"],
      },
    },
    {
      name: "jupyter_execute_code",
      description: "Execute Python (or other kernel) code on the Jupyter server and return output",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Code to execute" },
          kernel: { type: "string", description: "Kernel name (default: python3)" },
        },
        required: ["code"],
      },
    },
    {
      name: "jupyter_list_kernels",
      description: "List currently running kernels on the Jupyter server",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "jupyter_server_info",
      description: "Get Jupyter server version and status",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "jupyter_list_contents") {
      const path = args.path ? `/${args.path}` : "";
      const res = await httpsRequest("GET", `/api/contents${path}`);
      if (res.status !== 200) throw new Error(`Jupyter returned ${res.status}: ${res.text}`);
      const data = res.json();
      const items = (data.content || [])
        .map((item) => `${item.type === "directory" ? "d" : "-"}  ${item.path}`)
        .join("\n");
      return { content: [{ type: "text", text: items || "(empty)" }] };
    }

    if (name === "jupyter_read_notebook") {
      const res = await httpsRequest("GET", `/api/contents/${args.path}`);
      if (res.status !== 200) throw new Error(`Jupyter returned ${res.status}: ${res.text}`);
      const nb = res.json();
      const cells = (nb.content?.cells || [])
        .map((cell, i) => {
          const src = Array.isArray(cell.source) ? cell.source.join("") : cell.source;
          return `[Cell ${i + 1} — ${cell.cell_type}]\n${src}`;
        })
        .join("\n\n---\n\n");
      return { content: [{ type: "text", text: cells || "(no cells)" }] };
    }

    if (name === "jupyter_execute_code") {
      const output = await executeCode(String(args.code), args.kernel || "python3");
      return { content: [{ type: "text", text: output }] };
    }

    if (name === "jupyter_list_kernels") {
      const res = await httpsRequest("GET", "/api/kernels");
      if (res.status !== 200) throw new Error(`Jupyter returned ${res.status}: ${res.text}`);
      const kernels = res.json();
      const list = kernels
        .map((k) => `${k.id}  name=${k.name}  state=${k.execution_state}`)
        .join("\n");
      return { content: [{ type: "text", text: list || "(no running kernels)" }] };
    }

    if (name === "jupyter_server_info") {
      const res = await httpsRequest("GET", "/api");
      if (res.status !== 200) throw new Error(`Jupyter returned ${res.status}: ${res.text}`);
      return { content: [{ type: "text", text: res.text }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ---------- HTTP / SSE transport ----------

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
  if (!transport) { res.status(404).json({ error: "Session not found" }); return; }
  await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) =>
  res.json({ status: "ok", server: "jupyter-mcp", jupyter: JUPYTER_URL })
);

app.listen(MCP_PORT, "0.0.0.0", () => {
  console.log(`[jupyter-mcp] Listening on http://0.0.0.0:${MCP_PORT}`);
  console.log(`[jupyter-mcp] Jupyter target: ${JUPYTER_URL}`);
  console.log(`[jupyter-mcp] Auth: ${JUPYTER_TOKEN ? "token set" : "no token"}`);
});
