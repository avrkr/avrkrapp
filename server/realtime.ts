import http from "http";
import { WebSocketServer } from "ws";
import { jwtVerify } from "jose";
import { getEnv } from "../lib/env";
import { AmiClient } from "./services/ami-client";

type Client = {
  tenantId: number | null;
  role: string;
  ws: import("ws").WebSocket;
};

const clients = new Set<Client>();

async function verifyWsToken(token: string) {
  const secret = new TextEncoder().encode(getEnv().SESSION_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload as {
    tenantId: number | null;
    roleSlug: string;
    userId: number;
  };
}

function tenantFromAmiEvent(event: Record<string, string>): number | null {
  const acct = event.AccountCode ?? event.Accountcode;
  if (!acct) return null;
  const m = /^TENANT_(\d+)$/.exec(acct) ?? /^AVRKR_(\d+)$/.exec(acct);
  if (m) return Number(m[1]);
  return null;
}

async function main() {
  const env = getEnv();
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end("Avrkr realtime OK");
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const token = url.searchParams.get("token");
      if (!token) {
        ws.close(4401, "Unauthorized");
        return;
      }
      const session = await verifyWsToken(token);
      const client: Client = {
        tenantId: session.tenantId,
        role: session.roleSlug,
        ws,
      };
      clients.add(client);
      ws.on("close", () => clients.delete(client));
      ws.send(JSON.stringify({ type: "connected" }));
    } catch {
      ws.close(4401, "Unauthorized");
    }
  });

  let ami: AmiClient | null = null;
  try {
    ami = new AmiClient();
    await ami.connect();
    ami.onEvent((event) => {
      const payload = {
        type: "ami",
        event: event.Event,
        data: event,
      };
      const eventTenant = tenantFromAmiEvent(event);
      for (const c of clients) {
        if (c.role === "SUPER_ADMIN") {
          c.ws.send(JSON.stringify(payload));
          continue;
        }
        if (eventTenant == null || c.tenantId === eventTenant) {
          c.ws.send(JSON.stringify(payload));
        }
      }
    });
  } catch (err) {
    console.error("AMI connection failed:", err);
  }

  server.listen(env.WS_PORT, () => {
    console.log(`Realtime WS listening on :${env.WS_PORT}/ws`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
