import express from "express";
import http from "http";
import https from "https";
import { createReadStream, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

const DOCKER_SOCKET = "/var/run/docker.sock";
const HOSTINGER_URL = process.env.HOSTINGER_URL || "";
const JUPYTER_URL = process.env.JUPYTER_URL || "https://65.95.15.70:32225";
const JUPYTER_TOKEN = process.env.JUPYTER_TOKEN || "";
const POLL_INTERVAL = 30000;

app.use(express.static(join(__dirname, "public")));

// ── SSE clients ──────────────────────────────────────────────────────────────
const sseClients = new Set();

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const client = { res, id: Date.now() };
  sseClients.add(client);

  // Send current state immediately
  collectStatus().then((status) => {
    res.write(`data: ${JSON.stringify(status)}\n\n`);
  });

  req.on("close", () => sseClients.delete(client));
});

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) {
    try { c.res.write(msg); } catch (_) { sseClients.delete(c); }
  }
}

// ── API ───────────────────────────────────────────────────────────────────────
app.get("/api/status", async (req, res) => {
  try {
    res.json(await collectStatus());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/refresh", async (req, res) => {
  try {
    const status = await collectStatus();
    broadcast(status);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Docker socket helpers ─────────────────────────────────────────────────────
function dockerRequest(path) {
  return new Promise((resolve, reject) => {
    if (!existsSync(DOCKER_SOCKET)) {
      return reject(new Error("Docker socket not available"));
    }
    const req = http.request(
      { socketPath: DOCKER_SOCKET, path, method: "GET" },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch (e) { reject(e); }
        });
      }
    );
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("Docker timeout")); });
    req.on("error", reject);
    req.end();
  });
}

async function getDockerContainers() {
  try {
    const containers = await dockerRequest("/containers/json?all=true");
    return containers.map((c) => ({
      id: c.Id.slice(0, 12),
      name: (c.Names[0] || "").replace(/^\//, ""),
      image: c.Image,
      state: c.State,
      status: c.Status,
      ports: (c.Ports || [])
        .filter((p) => p.PublicPort)
        .map((p) => p.PublicPort),
    }));
  } catch (e) {
    return { error: e.message };
  }
}

// ── HTTP probe ────────────────────────────────────────────────────────────────
function probe(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const agent = parsed.protocol === "https:"
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;

    const req = mod.request(
      { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search, method: "GET",
        agent, headers: { Accept: "*/*" } },
      (res) => {
        res.resume();
        resolve({ ok: res.statusCode < 500, statusCode: res.statusCode, latencyMs: Date.now() - start });
      }
    );
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, statusCode: 0, latencyMs: timeoutMs, error: "timeout" }); });
    req.on("error", (e) => resolve({ ok: false, statusCode: 0, latencyMs: Date.now() - start, error: e.message }));
    req.end();
  });
}

// ── Status collector ──────────────────────────────────────────────────────────
const latencyHistory = {};

function recordLatency(key, ms) {
  if (!latencyHistory[key]) latencyHistory[key] = [];
  latencyHistory[key].push(ms);
  if (latencyHistory[key].length > 20) latencyHistory[key].shift();
}

async function collectStatus() {
  const ts = Date.now();

  const [
    vpnwatch,
    kaliMcp,
    jupyterMcp,
    excalidraw,
    jupyterExternal,
    hostinger,
    containers,
  ] = await Promise.allSettled([
    probe("http://localhost:3225/api/stats"),
    probe("http://localhost:8080/health"),
    probe("http://localhost:8081/health"),
    probe("http://localhost:3333"),
    probe(`${JUPYTER_URL}/api`, 6000),
    HOSTINGER_URL ? probe(HOSTINGER_URL) : Promise.resolve(null),
    getDockerContainers(),
  ]);

  const svc = (r, key) => {
    const v = r.status === "fulfilled" ? r.value : { ok: false, error: r.reason?.message };
    if (v && v.latencyMs !== undefined) recordLatency(key, v.latencyMs);
    return {
      ...v,
      history: latencyHistory[key] ? [...latencyHistory[key]] : [],
    };
  };

  return {
    ts,
    services: {
      vpnwatch: svc(vpnwatch, "vpnwatch"),
      kaliMcp: svc(kaliMcp, "kaliMcp"),
      jupyterMcp: svc(jupyterMcp, "jupyterMcp"),
      excalidraw: svc(excalidraw, "excalidraw"),
      jupyterExternal: svc(jupyterExternal, "jupyterExternal"),
      hostinger: HOSTINGER_URL ? svc(hostinger, "hostinger") : null,
    },
    containers: containers.status === "fulfilled" ? containers.value : { error: containers.reason?.message },
  };
}

// ── Poll loop ─────────────────────────────────────────────────────────────────
async function poll() {
  try {
    const status = await collectStatus();
    broadcast(status);
  } catch (_) {}
}

setInterval(poll, POLL_INTERVAL);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[infra-dashboard] listening on :${PORT}`);
  poll();
});
