"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";
const PHONE = process.env.NEXT_PUBLIC_VAPI_PHONE || "+1 (657) 837-9072";
const PHONE_DIGITS = PHONE.replace(/[^0-9+]/g, "");

const SUIT = { s: "♠", h: "♥", d: "♦", c: "♣" } as const;

type Player = {
  name: string;
  is_human: boolean;
  chips: number;
  bet: number;
  folded: boolean;
  all_in: boolean;
  hole: string[] | null;
};

type Game = {
  phase: string;
  board: string[];
  pot: number;
  current_bet: number;
  to_act: number;
  awaiting_human: boolean;
  human_index: number;
  players: Player[];
  log: string[];
  winner: { indices: number[]; hand: string } | null;
  to_call: number;
  min_raise_to: number;
  options: string[];
};

function Card({ c, hidden }: { c?: string | null; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="h-16 w-11 rounded-md border border-indigo-300/30 bg-gradient-to-br from-indigo-700 to-indigo-900 shadow" />
    );
  }
  if (!c) {
    return <div className="h-16 w-11 rounded-md border border-white/10 bg-white/5" />;
  }
  const rank = c[0] === "T" ? "10" : c[0];
  const suit = c[1] as keyof typeof SUIT;
  const red = suit === "h" || suit === "d";
  return (
    <div className="flex h-16 w-11 flex-col items-center justify-center rounded-md border border-black/10 bg-white shadow">
      <span className={`text-lg font-bold ${red ? "text-red-600" : "text-gray-900"}`}>{rank}</span>
      <span className={`text-lg leading-none ${red ? "text-red-600" : "text-gray-900"}`}>{SUIT[suit]}</span>
    </div>
  );
}

function Seat({ p, active, isWinner }: { p: Player; active: boolean; isWinner: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
        active ? "border-amber-400 bg-amber-400/10 ring-2 ring-amber-400" : "border-white/10 bg-black/30"
      } ${p.folded ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span>{p.name}</span>
        {p.is_human && <span className="rounded bg-emerald-600 px-1.5 text-xs">you</span>}
        {p.all_in && <span className="rounded bg-red-600 px-1.5 text-xs">all-in</span>}
        {isWinner && <span className="rounded bg-amber-500 px-1.5 text-xs text-black">winner</span>}
      </div>
      <div className="flex gap-1">
        <Card c={p.hole?.[0]} hidden={!p.folded && p.hole === null} />
        <Card c={p.hole?.[1]} hidden={!p.folded && p.hole === null} />
      </div>
      <div className="text-center text-xs text-neutral-300">
        <div className="font-mono text-sm text-emerald-300">{p.chips}</div>
        {p.bet > 0 && <div className="text-amber-300">bet {p.bet}</div>}
      </div>
    </div>
  );
}

type FeedEvent = {
  query: string;
  latency_ms: number | null;
  index: string;
  ts: number;
  results: { text: string; score: number; street: string }[];
};

const STREET_COLOR: Record<string, string> = {
  preflop: "bg-sky-500/20 text-sky-300",
  flop: "bg-emerald-500/20 text-emerald-300",
  turn: "bg-amber-500/20 text-amber-300",
  river: "bg-rose-500/20 text-rose-300",
  general: "bg-violet-500/20 text-violet-300",
};

function MossPanel() {
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/moss/feed`);
        if (r.ok) setFeed(await r.json());
      } catch {
        /* backend not up */
      }
    };
    load();
    const poll = setInterval(load, 1000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  return (
    <aside className="mt-6 w-full rounded-2xl border border-fuchsia-500/30 bg-black p-4 lg:fixed lg:right-0 lg:top-0 lg:mt-0 lg:h-screen lg:w-[380px] lg:overflow-y-auto lg:rounded-none lg:border-0 lg:border-l">
      <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/moss-logo.png" alt="MOSS" className="h-11 w-11 brightness-0 invert" />
        <div className="leading-tight">
          <div className="font-bold tracking-wide text-white">
            MOSS<span className="text-fuchsia-400"> retrieval</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-emerald-400">live · in-process · zero network hops</div>
        </div>
      </div>

      <div className="mb-3 text-[10px] leading-snug text-neutral-500">
        Semantic search runs <span className="text-cyan-400">inside the backend</span> — no 200–500ms
        round trip to a remote vector DB.
      </div>

      {feed.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-10 text-center text-sm text-neutral-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-500" />
          Ask the phone agent for advice to see live retrievals…
        </div>
      )}

      <div className="flex flex-col gap-3">
        {feed.map((e, i) => {
          const fast = e.latency_ms !== null && e.latency_ms < 30;
          return (
            <div key={i} className="rounded-xl border border-white/10 bg-neutral-950 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`rounded-md px-2 py-0.5 font-mono text-sm font-bold ${
                    fast
                      ? "bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_0] shadow-emerald-500/50"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {e.latency_ms !== null ? `${e.latency_ms} ms` : "—"}
                </span>
                <span className="text-[10px] text-neutral-500">{Math.max(0, Math.round(now / 1000 - e.ts))}s ago</span>
              </div>
              <div className="mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                  query → {e.index}
                </div>
                <div className="text-xs text-amber-200">{e.query}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                {e.results.map((r, j) => (
                  <div key={j} className="flex gap-2 text-xs">
                    <span className="shrink-0 rounded bg-fuchsia-500/20 px-1.5 font-mono text-fuchsia-300">{r.score}</span>
                    <span className={`h-fit shrink-0 rounded px-1.5 text-[10px] uppercase ${STREET_COLOR[r.street] || "bg-neutral-700 text-neutral-300"}`}>
                      {r.street}
                    </span>
                    <span className="text-neutral-300">{r.text}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default function Home() {
  const [game, setGame] = useState<Game | null>(null);
  const [raise, setRaise] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API}/game/state`);
      if (r.ok) setGame(await r.json());
    } catch {
      /* backend not up yet */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1200);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (game?.awaiting_human) setRaise(game.min_raise_to);
  }, [game?.awaiting_human, game?.min_raise_to]);

  async function newHand() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`${API}/game/new`, { method: "POST" });
      setGame(await r.json());
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, amount = 0) {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`${API}/game/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, amount }),
      });
      const data = await r.json();
      if (!r.ok) setErr(data.error || "illegal move");
      else setGame(data);
    } finally {
      setBusy(false);
    }
  }

  const my = game ? game.players[game.human_index] : null;
  const myTurn = !!game?.awaiting_human;
  const opts = game?.options || [];
  const winners = game?.winner?.indices || [];

  return (
    <div className="min-h-screen p-6 lg:pr-[404px]">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Voice Poker <span className="text-sm font-normal text-neutral-400">Texas Hold&apos;em vs bots</span>
        </h1>
        <button
          onClick={newHand}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          New hand
        </button>
      </div>

      <a
        href={`tel:${PHONE_DIGITS}`}
        className="flex items-center justify-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-4 py-3 text-center transition hover:bg-indigo-500/20"
      >
        <span className="text-lg">📞</span>
        <span className="text-neutral-300">Call to play your seat:</span>
        <span className="font-mono text-lg font-bold text-indigo-200">{PHONE}</span>
      </a>

      {!game && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-10 text-center text-neutral-400">
          No game yet — click <span className="text-emerald-300">New hand</span> to deal.
        </div>
      )}

      {game && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {game.players.map((p, i) =>
              p.is_human ? null : (
                <Seat key={i} p={p} active={game.to_act === i && game.phase !== "done"} isWinner={winners.includes(i)} />
              ),
            )}
          </div>

          <div
            className="flex flex-col items-center gap-4 rounded-3xl border border-emerald-900 p-8"
            style={{ background: "radial-gradient(ellipse at center, #15803d33, #052e16)" }}
          >
            <div className="text-sm uppercase tracking-widest text-emerald-300">{game.phase}</div>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Card key={i} c={game.board[i]} />
              ))}
            </div>
            <div className="rounded-full bg-black/40 px-4 py-1 font-mono text-amber-300">pot {game.pot}</div>
            {game.winner && (
              <div className="text-lg font-semibold text-amber-300">
                {winners.map((i) => game.players[i].name).join(", ")} win with {game.winner.hand}
              </div>
            )}
          </div>

          {my && (
            <div className="flex justify-center">
              <Seat p={my} active={myTurn} isWinner={winners.includes(game.human_index)} />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              disabled={!myTurn || busy || !opts.includes("fold")}
              onClick={() => act("fold")}
              className="rounded-lg bg-red-700 px-5 py-2 font-semibold hover:bg-red-600 disabled:opacity-30"
            >
              Fold
            </button>
            <button
              disabled={!myTurn || busy || !(opts.includes("check") || opts.includes("call"))}
              onClick={() => act(opts.includes("check") ? "check" : "call")}
              className="rounded-lg bg-sky-700 px-5 py-2 font-semibold hover:bg-sky-600 disabled:opacity-30"
            >
              {opts.includes("check") ? "Check" : `Call ${game.to_call}`}
            </button>
            <div className="flex items-center gap-1">
              <button
                disabled={!myTurn || busy || !opts.includes("raise")}
                onClick={() => act("raise", raise)}
                className="rounded-lg bg-amber-600 px-5 py-2 font-semibold hover:bg-amber-500 disabled:opacity-30"
              >
                Raise to
              </button>
              <input
                type="number"
                value={raise}
                step={20}
                onChange={(e) => setRaise(Number(e.target.value))}
                disabled={!myTurn || !opts.includes("raise")}
                className="w-24 rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-center font-mono disabled:opacity-30"
              />
            </div>
            <button
              disabled={!myTurn || busy || !opts.includes("allin")}
              onClick={() => act("allin")}
              className="rounded-lg bg-fuchsia-700 px-5 py-2 font-semibold hover:bg-fuchsia-600 disabled:opacity-30"
            >
              All-in
            </button>
          </div>

          {err && <div className="text-center text-sm text-red-400">{err}</div>}
          {!myTurn && game.phase !== "done" && (
            <div className="text-center text-sm text-neutral-400">waiting for bots…</div>
          )}

          <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-neutral-300">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Hand log</div>
            <div className="flex flex-col gap-0.5 font-mono text-xs">
              {game.log.slice(-8).map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </>
      )}
      </main>
      <MossPanel />
    </div>
  );
}
