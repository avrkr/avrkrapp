"use client";

import { useEffect, useState } from "react";

type CallRow = {
  id: number;
  caller_number: string | null;
  dest_number: string | null;
  call_type: string;
  status: string;
  start_time: string;
  duration: number;
};

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRow[]>([]);

  useEffect(() => {
    fetch("/api/calls")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCalls(json.data.calls);
      });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Call logs</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Duration</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} className="border-t border-slate-800">
                <td className="px-4 py-3">{new Date(c.start_time).toLocaleString()}</td>
                <td className="px-4 py-3">{c.caller_number ?? "—"}</td>
                <td className="px-4 py-3">{c.dest_number ?? "—"}</td>
                <td className="px-4 py-3">{c.call_type}</td>
                <td className="px-4 py-3">{c.status}</td>
                <td className="px-4 py-3">{c.duration}s</td>
              </tr>
            ))}
            {!calls.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No calls yet for this tenant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
