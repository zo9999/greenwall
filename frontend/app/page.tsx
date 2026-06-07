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

function Card({ c, hidden, delay = 0 }: { c?: string | null; hidden?: boolean; delay?: number }) {
  if (hidden) {
    return (
      <div
        className="deal-in flex h-20 w-14 items-center justify-center rounded-lg border border-amber-300/50 bg-gradient-to-br from-rose-700 via-red-800 to-amber-800 shadow-md"
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="h-14 w-9 rounded-sm border border-amber-200/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(251,191,36,0.35)_4px,rgba(251,191,36,0.35)_5px)]" />
      </div>
    );
  }
  if (!c) {
    return <div className="h-20 w-14 rounded-lg border border-dashed border-amber-900/20 bg-amber-900/5" />;
  }
  const rank = c[0] === "T" ? "10" : c[0];
  const suit = c[1] as keyof typeof SUIT;
  const red = suit === "h" || suit === "d";
  const col = red ? "text-rose-600" : "text-neutral-900";
  return (
    <div
      className="deal-in relative h-20 w-14 rounded-lg border border-black/15 bg-gradient-to-br from-white to-neutral-100 shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute left-1.5 top-1 flex flex-col items-center leading-none ${col}`}>
        <span className="text-sm font-bold">{rank}</span>
        <span className="text-[11px]">{SUIT[suit]}</span>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center text-3xl ${col}`}>{SUIT[suit]}</div>
      <div className={`absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center leading-none ${col}`}>
        <span className="text-sm font-bold">{rank}</span>
        <span className="text-[11px]">{SUIT[suit]}</span>
      </div>
    </div>
  );
}

const CHIP_DENOMS = [
  { v: 500, bg: "bg-violet-600", edge: "border-violet-200" },
  { v: 100, bg: "bg-neutral-800", edge: "border-neutral-400" },
  { v: 25, bg: "bg-emerald-600", edge: "border-emerald-200" },
  { v: 10, bg: "bg-sky-600", edge: "border-sky-200" },
  { v: 5, bg: "bg-red-600", edge: "border-red-200" },
  { v: 1, bg: "bg-neutral-100", edge: "border-neutral-400" },
];

function ChipStack({ amount }: { amount: number }) {
  if (!amount || amount <= 0) return null;
  let rem = amount;
  const piles: { v: number; bg: string; edge: string; count: number }[] = [];
  for (const d of CHIP_DENOMS) {
    const n = Math.floor(rem / d.v);
    if (n > 0) {
      piles.push({ ...d, count: n });
      rem -= n * d.v;
    }
  }
  return (
    <div className="flex items-end gap-1.5">
      {piles.map((p) => {
        const visible = Math.min(p.count, 5);
        return (
          <div key={p.v} className="flex flex-col items-center">
            <div className="relative w-6" style={{ height: `${24 + (visible - 1) * 6}px` }}>
              {Array.from({ length: visible }).map((_, j) => (
                <div
                  key={j}
                  className={`absolute left-0 h-6 w-6 rounded-full border-[3px] border-dashed shadow ${p.edge} ${p.bg}`}
                  style={{ bottom: `${j * 6}px` }}
                >
                  <div className="absolute inset-1 rounded-full border border-white/40" />
                </div>
              ))}
            </div>
            <span className="mt-0.5 text-[9px] font-semibold text-neutral-400">
              {p.count > 5 ? `${p.v}×${p.count}` : p.v}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Seat({ p, active, isWinner }: { p: Player; active: boolean; isWinner: boolean }) {
  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all duration-500 ${
        isWinner
          ? "winner-glow border-amber-400 bg-amber-50"
          : active
            ? "gold-pulse border-amber-400 bg-amber-50"
            : "border-amber-900/15 bg-white/70 shadow-sm"
      } ${p.folded ? "opacity-40 grayscale" : "opacity-100"}`}
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
        <span>{p.name}</span>
        {p.is_human && <span className="rounded bg-emerald-600 px-1.5 text-[11px] text-white">you</span>}
        {p.all_in && <span className="rounded bg-red-600 px-1.5 text-[11px] text-white">all-in</span>}
        {isWinner && (
          <span className="rounded bg-gradient-to-r from-amber-400 to-yellow-500 px-1.5 text-[11px] font-bold text-black">winner</span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex gap-1">
          <Card c={p.hole?.[0]} hidden={!p.folded && p.hole === null} />
          <Card c={p.hole?.[1]} hidden={!p.folded && p.hole === null} />
        </div>
        <ChipStack amount={p.chips} />
      </div>
      <div className="text-center">
        <div className="font-mono text-sm font-semibold text-emerald-700">{p.chips}</div>
        {p.bet > 0 && (
          <div className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 text-xs font-medium text-amber-700">bet {p.bet}</div>
        )}
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
                <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">query → {e.index}</div>
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
  const lastLog = game && game.log.length ? game.log[game.log.length - 1] : null;

  return (
    <div className="min-h-screen p-6 lg:pr-[404px]">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            Voice <span className="text-[#c8851a]">Poker</span>
            <span className="ml-2 text-sm font-normal text-neutral-500">Texas Hold&apos;em vs bots</span>
          </h1>
          <button
            onClick={newHand}
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 font-bold text-black shadow transition hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50"
          >
            New hand
          </button>
        </div>

        <a
          href={`tel:${PHONE_DIGITS}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-100 to-yellow-50 px-4 py-3 text-center shadow-sm transition hover:from-amber-200 hover:to-yellow-100"
        >
          <span className="text-lg">📞</span>
          <span className="text-neutral-700">Call to play your seat:</span>
          <span className="font-mono text-lg font-bold text-amber-700">{PHONE}</span>
        </a>

        {!game && (
          <div className="rounded-xl border border-amber-900/15 bg-white/70 p-10 text-center text-neutral-500 shadow-sm">
            No game yet — click <span className="font-semibold text-amber-600">New hand</span> to deal.
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
              className="relative flex flex-col items-center gap-4 rounded-[2rem] border-4 border-amber-400/50 p-8 shadow-xl"
              style={{ background: "radial-gradient(ellipse at center, #1c7a4d, #0a3a25)" }}
            >
              {lastLog && (
                <div
                  key={lastLog}
                  className="toast-in pointer-events-none absolute -top-3 left-1/2 z-10 rounded-full bg-neutral-900/90 px-4 py-1 text-sm font-semibold text-amber-200 shadow-lg ring-1 ring-amber-400/30"
                >
                  {lastLog}
                </div>
              )}
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/90">{game.phase}</div>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Card key={game.board[i] ?? `empty-${i}`} c={game.board[i]} delay={i * 90} />
                ))}
              </div>
              <div className="flex flex-col items-center gap-2">
                {game.pot > 0 && <ChipStack amount={game.pot} />}
                <div
                  key={game.pot}
                  className="pot-bump rounded-full bg-black/40 px-4 py-1 font-mono font-semibold text-amber-300 ring-1 ring-amber-400/30"
                >
                  pot {game.pot}
                </div>
              </div>
              {game.winner && (
                <div className="text-lg font-bold text-amber-300">
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
                className="rounded-lg bg-red-600 px-5 py-2 font-bold text-white shadow transition hover:bg-red-500 disabled:opacity-30 disabled:shadow-none"
              >
                Fold
              </button>
              <button
                disabled={!myTurn || busy || !(opts.includes("check") || opts.includes("call"))}
                onClick={() => act(opts.includes("check") ? "check" : "call")}
                className="rounded-lg bg-emerald-600 px-5 py-2 font-bold text-white shadow transition hover:bg-emerald-500 disabled:opacity-30 disabled:shadow-none"
              >
                {opts.includes("check") ? "Check" : `Call ${game.to_call}`}
              </button>
              <div className="flex items-center gap-1">
                <button
                  disabled={!myTurn || busy || !opts.includes("raise")}
                  onClick={() => act("raise", raise)}
                  className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2 font-bold text-black shadow transition hover:from-amber-400 hover:to-yellow-400 disabled:opacity-30 disabled:shadow-none"
                >
                  Raise to
                </button>
                <input
                  type="number"
                  value={raise}
                  step={20}
                  onChange={(e) => setRaise(Number(e.target.value))}
                  disabled={!myTurn || !opts.includes("raise")}
                  className="w-24 rounded-lg border border-amber-900/20 bg-white px-2 py-2 text-center font-mono text-neutral-800 disabled:opacity-40"
                />
              </div>
              <button
                disabled={!myTurn || busy || !opts.includes("allin")}
                onClick={() => act("allin")}
                className="rounded-lg bg-gradient-to-r from-orange-500 to-[#ff6a00] px-5 py-2 font-bold text-white shadow transition hover:brightness-110 disabled:opacity-30 disabled:shadow-none"
              >
                All-in
              </button>
            </div>

            {err && <div className="text-center text-sm font-medium text-red-600">{err}</div>}
            {!myTurn && game.phase !== "done" && (
              <div className="text-center text-sm text-neutral-500">waiting for bots…</div>
            )}

            <div className="rounded-xl border border-amber-900/15 bg-white/70 p-3 text-sm text-neutral-700 shadow-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700/70">Hand log</div>
              <div className="flex flex-col gap-0.5 font-mono text-xs text-neutral-600">
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
