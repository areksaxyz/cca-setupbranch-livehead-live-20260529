import fs from "node:fs";

const capturePath = "/tmp/adddir-mcp-capture.json";
let buffer = Buffer.alloc(0);

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(
    `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`,
  );
}

function sendError(id, code, message) {
  send({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}

function sendTextResult(id, text) {
  send({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text }],
    },
  });
}

function handleMessage(message) {
  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "late_server",
          version: "1.0.0",
        },
      },
    });
    return;
  }

  if (message.method === "notifications/initialized") {
    return;
  }

  if (message.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        tools: [
          {
            name: "capture_env",
            description:
              "Capture selected privileged-run environment markers to a file",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        ],
      },
    });
    return;
  }

  if (message.method === "tools/call") {
    if (message.params?.name !== "capture_env") {
      sendError(message.id, -32601, "Unknown tool");
      return;
    }

    const githubToken = process.env.GITHUB_TOKEN || "";
    const ghToken = process.env.GH_TOKEN || "";

    const capture = {
      marker: "ADDDIR_MCP_CAPTURE",
      cwd: process.cwd(),
      argv: process.argv.slice(0, 4),
      hasGITHUB_TOKEN: githubToken.length > 0,
      githubTokenLen: githubToken.length,
      githubTokenPrefix: githubToken.slice(0, 4),
      hasGH_TOKEN: ghToken.length > 0,
      ghTokenLen: ghToken.length,
      ghTokenPrefix: ghToken.slice(0, 4),
      repository: process.env.GITHUB_REPOSITORY || null,
      event: process.env.GITHUB_EVENT_NAME || null,
    };

    fs.writeFileSync(capturePath, `${JSON.stringify(capture, null, 2)}\n`);
    sendTextResult(message.id, "CAPTURE_OK");
    return;
  }

  if (message.id !== undefined) {
    sendError(message.id, -32601, `Method not found: ${message.method}`);
  }
}

function drainBuffer() {
  for (;;) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;

    const header = buffer.slice(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = Buffer.alloc(0);
      return;
    }

    const bodyLength = Number(match[1]);
    const messageEnd = headerEnd + 4 + bodyLength;
    if (buffer.length < messageEnd) return;

    const body = buffer.slice(headerEnd + 4, messageEnd).toString("utf8");
    buffer = buffer.slice(messageEnd);

    try {
      handleMessage(JSON.parse(body));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      send({
        jsonrpc: "2.0",
        error: { code: -32700, message },
      });
    }
  }
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  drainBuffer();
});
