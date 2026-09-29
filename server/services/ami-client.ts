import net from "net";
import { getEnv } from "@/lib/env";

export type AmiEvent = Record<string, string>;

export class AmiClient {
  private socket: net.Socket | null = null;
  private buffer = "";
  private listeners: Array<(event: AmiEvent) => void> = [];

  async connect(): Promise<void> {
    const env = getEnv();
    if (!env.AMI_USERNAME || !env.AMI_PASSWORD) {
      throw new Error("AMI credentials not configured");
    }

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(env.AMI_PORT, env.AMI_HOST);
      this.socket.setEncoding("utf8");

      this.socket.once("error", reject);
      this.socket.once("data", (chunk) => {
        this.buffer += chunk;
        if (this.buffer.includes("Asterisk Call Manager")) {
          this.sendAction({
            Action: "Login",
            Username: env.AMI_USERNAME!,
            Secret: env.AMI_PASSWORD!,
            Events: "on",
          });
        }
      });

      const onData = (chunk: string) => {
        this.buffer += chunk;
        const blocks = this.buffer.split("\r\n\r\n");
        this.buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const event = parseAmiBlock(block);
          if (event.Response === "Success" && event.Message === "Authentication accepted") {
            this.socket?.off("data", onData);
            this.socket?.on("data", (c) => this.handleData(c.toString()));
            resolve();
            return;
          }
          if (event.Response === "Error") {
            reject(new Error(event.Message ?? "AMI login failed"));
          }
        }
      };
      this.socket.on("data", onData);
    });
  }

  onEvent(fn: (event: AmiEvent) => void) {
    this.listeners.push(fn);
  }

  sendAction(fields: Record<string, string>) {
    if (!this.socket) throw new Error("AMI not connected");
    const body =
      Object.entries(fields)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\r\n") + "\r\n\r\n";
    this.socket.write(body);
  }

  disconnect() {
    this.socket?.destroy();
    this.socket = null;
  }

  private handleData(chunk: string) {
    this.buffer += chunk;
    const blocks = this.buffer.split("\r\n\r\n");
    this.buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const event = parseAmiBlock(block);
      if (event.Event) {
        for (const l of this.listeners) l(event);
      }
    }
  }
}

function parseAmiBlock(block: string): AmiEvent {
  const out: AmiEvent = {};
  for (const line of block.split("\r\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

export async function pingAmi(): Promise<boolean> {
  try {
    const client = new AmiClient();
    await client.connect();
    client.disconnect();
    return true;
  } catch {
    return false;
  }
}
