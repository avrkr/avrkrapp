"use client";

import { FormEvent, useEffect, useState } from "react";

type Extension = {
  id: number;
  extension: string;
  display_name: string;
  enabled: number;
  webrtc_enabled: number;
};

export default function ExtensionsPage() {
  const [items, setItems] = useState<Extension[]>([]);
  const [extension, setExtension] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/extensions");
    const json = await res.json();
    if (json.success) setItems(json.data.extensions);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/extensions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extension, displayName }),
    });
    const json = await res.json();
    if (!json.success) {
      setMessage(json.message);
      return;
    }
    setMessage(`Created ${json.data.extension ?? extension}. SIP secret shown once: ${json.data.sipSecret}`);
    setExtension("");
    setDisplayName("");
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Extensions</h1>
      <form onSubmit={onCreate} className="mt-6 grid max-w-lg gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <input
          placeholder="Extension (e.g. 1001)"
          value={extension}
          onChange={(e) => setExtension(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
        />
        <input
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-cyan-600 py-2 text-sm font-medium">
          Create extension
        </button>
        {message && <p className="text-sm text-amber-300">{message}</p>}
      </form>
      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Extension</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">WebRTC</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="px-4 py-3">{row.extension}</td>
                <td className="px-4 py-3">{row.display_name}</td>
                <td className="px-4 py-3">{row.webrtc_enabled ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{row.enabled ? "Enabled" : "Disabled"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
