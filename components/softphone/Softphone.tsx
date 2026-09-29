"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Registerer,
  RegistererState,
  SessionState,
  UserAgent,
  Inviter,
  Invitation,
} from "sip.js";
import clsx from "clsx";

type SoftphoneConfig = {
  displayName: string;
  extension: string;
  sipUri: string;
  authorizationUsername: string;
  authorizationPassword: string;
  wsServer: string;
  iceServers: RTCIceServer[];
};

export function Softphone() {
  const [config, setConfig] = useState<SoftphoneConfig | null>(null);
  const [regState, setRegState] = useState<string>("idle");
  const [dial, setDial] = useState("");
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [timer, setTimer] = useState(0);
  const uaRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Inviter | Invitation | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch("/api/softphone/config")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setConfig(json.data);
      });
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const bindSession = useCallback((session: Inviter | Invitation) => {
    sessionRef.current = session;
    session.stateChange.addListener((state) => {
      if (state === SessionState.Established) {
        setActive(true);
        setTimer(0);
        const pc = (
          session.sessionDescriptionHandler as { peerConnection?: RTCPeerConnection }
        )?.peerConnection;
        if (pc && remoteAudioRef.current) {
          pc.ontrack = (ev) => {
            remoteAudioRef.current!.srcObject = ev.streams[0] ?? null;
            void remoteAudioRef.current!.play();
          };
        }
      }
      if (state === SessionState.Terminated) {
        setActive(false);
        setHeld(false);
        setMuted(false);
        sessionRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    (async () => {
      const uri = UserAgent.makeURI(config.sipUri);
      if (!uri) return;

      const ua = new UserAgent({
        uri,
        transportOptions: { server: config.wsServer },
        authorizationUsername: config.authorizationUsername,
        authorizationPassword: config.authorizationPassword,
        displayName: config.displayName,
        sessionDescriptionHandlerFactoryOptions: {
          peerConnectionConfiguration: { iceServers: config.iceServers },
        },
        delegate: {
          onInvite: (invitation) => {
            bindSession(invitation);
            invitation.accept();
          },
        },
      });

      uaRef.current = ua;
      await ua.start();
      if (cancelled) return;

      const registerer = new Registerer(ua);
      registererRef.current = registerer;
      registerer.stateChange.addListener((s) => {
        setRegState(RegistererState[s] ?? String(s));
      });
      await registerer.register();
    })().catch(() => setRegState("disconnected"));

    return () => {
      cancelled = true;
      registererRef.current?.unregister().catch(() => undefined);
      uaRef.current?.stop().catch(() => undefined);
    };
  }, [config, bindSession]);

  async function call() {
    const ua = uaRef.current;
    if (!ua || !config || !dial) return;
    const target = UserAgent.makeURI(`sip:${dial}@${new URL(config.sipUri.replace("sip:", "http:")).host}`);
    if (!target) return;
    const inviter = new Inviter(ua, target);
    bindSession(inviter);
    await inviter.invite();
  }

  async function hangup() {
    await sessionRef.current?.bye?.();
    setActive(false);
  }

  async function toggleMute() {
    const pc = (
      sessionRef.current?.sessionDescriptionHandler as {
        peerConnection?: RTCPeerConnection;
      }
    )?.peerConnection;
    pc?.getSenders().forEach((s) => {
      if (s.track?.kind === "audio") s.track.enabled = muted;
    });
    setMuted(!muted);
  }

  async function toggleHold() {
    const s = sessionRef.current;
    if (!s) return;
    if (!held) await s.invite({ sessionDescriptionHandlerModifiers: [] });
    setHeld(!held);
  }

  function sendDtmf(d: string) {
    const s = sessionRef.current as { dtmf?: (tone: string) => void } | null;
    s?.dtmf?.(d);
  }

  const pad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Web Softphone</h2>
          <span
            className={clsx(
              "rounded-full px-3 py-1 text-xs",
              regState === "Registered"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-amber-500/20 text-amber-200",
            )}
          >
            {regState}
          </span>
        </div>
        <input
          value={dial}
          onChange={(e) => setDial(e.target.value)}
          placeholder="Dial extension or number"
          className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-500"
        />
        <div className="grid grid-cols-3 gap-2">
          {pad.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDial((v) => v + d);
                if (active) sendDtmf(d);
              }}
              className="rounded-lg bg-slate-800 py-3 text-lg hover:bg-slate-700"
            >
              {d}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={call}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-500"
          >
            Call
          </button>
          <button
            type="button"
            onClick={hangup}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm hover:bg-rose-500"
          >
            Hangup
          </button>
          <button type="button" onClick={toggleHold} className="rounded-lg border border-slate-600 px-4 py-2 text-sm">
            {held ? "Resume" : "Hold"}
          </button>
          <button type="button" onClick={toggleMute} className="rounded-lg border border-slate-600 px-4 py-2 text-sm">
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>
        {active && (
          <p className="mt-4 text-sm text-slate-400">
            Active call · {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
          </p>
        )}
        <audio ref={remoteAudioRef} autoPlay className="hidden" />
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h3 className="mb-2 font-medium">Connection</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          <li>Extension: {config?.extension ?? "—"}</li>
          <li>WSS: {config?.wsServer ?? "—"}</li>
          <li>WebRTC: Opus / ulaw / alaw</li>
        </ul>
      </section>
    </div>
  );
}
