import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const token = process.env.OPENCLAW_DELIVERY_TOKEN;
if (!token) throw new Error("OPENCLAW_DELIVERY_TOKEN is required");

function runOpenClaw(args, input = null) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["dist/index.js", ...args], { cwd: "/app" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout)));
    if (input) { child.stdin.write(input); child.stdin.end(); }
  });
}

function authorized(request) {
  return request.headers.authorization === `Bearer ${token}`;
}

async function readBody(request) {
  const parts = [];
  for await (const chunk of request) parts.push(chunk);
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/healthz") return response.writeHead(200).end("ok");
  if (!authorized(request)) return response.writeHead(401).end();

  if (request.method === "POST" && request.url === "/v1/whatsapp/login") {
    runOpenClaw(["channels", "login", "--channel", "whatsapp", "--account", "default"])
      .catch(error => console.error("WhatsApp login failed", error.message));
    return response.writeHead(202, { "Content-Type": "application/json" }).end('{"status":"qr_requested"}');
  }

  if (request.method === "GET" && request.url === "/v1/whatsapp/qr") {
    try {
      const output = await runOpenClaw(["gateway", "call", "web.login.start", "--params", JSON.stringify({ channel: "whatsapp", accountId: "default", force: true }), "--json"]);
      const line = output.trim().split(/\r?\n/).filter(Boolean).pop();
      const payload = JSON.parse(line);
      const qr = payload.qrDataUrl || payload.qr || payload.dataUrl || payload.data?.qrDataUrl;
      if (!qr) throw new Error("OpenClaw did not return a QR payload");
      return response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify({ qr_data_url: qr }));
    } catch (error) {
      console.error("WhatsApp QR retrieval failed", error.message);
      return response.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error.message }));
    }
  }

  if (request.method !== "POST" || request.url !== "/v1/whatsapp/documents") return response.writeHead(404).end();
  try {
    const body = await readBody(request);
    if (!/^\+\d{8,15}$/.test(body.to) || !body.filename || !body.pdf_base64) throw new Error("Invalid request");
    const directory = await mkdtemp(join(tmpdir(), "openclaw-"));
    const file = join(directory, body.filename.replace(/[^A-Za-z0-9._-]/g, "-"));
    try {
      await writeFile(file, Buffer.from(body.pdf_base64, "base64"));
      await runOpenClaw(["message", "send", "--channel", "whatsapp", "--target", body.to, "--media", file, "--message", body.caption || "Your document is attached.", "--json"]);
    } finally { await rm(directory, { recursive: true, force: true }); }
    response.writeHead(202, { "Content-Type": "application/json" }).end('{"status":"accepted"}');
  } catch (error) {
    console.error("WhatsApp document delivery failed:", error.message);
    response.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "failed", error: error.message }));
  }
}).listen(8080, "0.0.0.0");
