"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { sfx, setMuted } from "./sound";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";
const PHONE = process.env.NEXT_PUBLIC_VAPI_PHONE || "+1 (657) 837-9072";
const PHONE_DIGITS = PHONE.replace(/[^0-9+]/g, "");

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
  dealer: number;
  players: Player[];
  log: string[];
  winner: { indices: number[]; hand: string } | null;
  to_call: number;
  min_raise_to: number;
  options: string[];
};

const MODEL_BY_NAME: Record<string, string> = {
  Ada: "gpt-4.1-nano",
  Boris: "gpt-5-nano",
  Cleo: "gpt-4.1-nano",
};

const CHIP_DENOMS = [
  { v: 500, bg: "bg-violet-600", edge: "border-violet-200" },
  { v: 100, bg: "bg-neutral-800", edge: "border-neutral-400" },
  { v: 25, bg: "bg-emerald-600", edge: "border-emerald-200" },
  { v: 10, bg: "bg-sky-600", edge: "border-sky-200" },
  { v: 5, bg: "bg-red-600", edge: "border-red-200" },
  { v: 1, bg: "bg-neutral-100", edge: "border-neutral-400" },
];

const SEAT_POS = [
  { left: "50%", top: "93%" },
  { left: "7%", top: "46%" },
  { left: "50%", top: "6%" },
  { left: "93%", top: "46%" },
];
const BET_POS = [
  { left: "50%", top: "71%" },
  { left: "28%", top: "49%" },
  { left: "50%", top: "28%" },
  { left: "72%", top: "49%" },
];

function codeOf(c: string) {
  return (c[0] === "T" ? "10" : c[0]) + c[1].toUpperCase();
}
function roleLabel(i: number, dealer: number) {
  if (i === dealer) return "D";
  if (i === (dealer + 1) % 4) return "SB";
  if (i === (dealer + 2) % 4) return "BB";
  return null;
}

function CardImg({ code, deal, delay = 0 }: { code: string; deal?: boolean; delay?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/cards/${code}.svg`}
      alt={code}
      className={`${deal ? "deal-in " : ""}h-20 w-14 rounded-lg bg-white shadow-md ring-1 ring-black/10`}
      style={deal ? { animationDelay: `${delay}ms` } : undefined}
    />
  );
}
function CardBack() {
  return (
    <div className="flex h-20 w-14 items-center justify-center rounded-lg border border-amber-300/50 bg-gradient-to-br from-rose-700 via-red-800 to-amber-800 shadow-md">
      <div className="h-14 w-9 rounded-sm border border-amber-200/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(251,191,36,0.35)_4px,rgba(251,191,36,0.35)_5px)]" />
    </div>
  );
}
function EmptySlot() {
  return <div className="h-20 w-14 rounded-lg border border-dashed border-amber-900/20 bg-amber-900/5" />;
}
function Card({ c, delay = 0 }: { c?: string | null; delay?: number }) {
  if (!c) return <EmptySlot />;
  return <CardImg code={codeOf(c)} deal delay={delay} />;
}
function FlipCard({ c, faceUp }: { c?: string | null; faceUp: boolean }) {
  return (
    <div className="h-20 w-14 [perspective:700px]">
      <div
        className={`relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] ${
          faceUp ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <CardBack />
        </div>
        <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
          {c ? <CardImg code={codeOf(c)} /> : <CardBack />}
        </div>
      </div>
    </div>
  );
}

function ChipStack({ amount, mini }: { amount: number; mini?: boolean }) {
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
  const w = mini ? 16 : 24;
  const step = mini ? 4 : 6;
  const disc = mini ? "h-4 w-4 border-2" : "h-6 w-6 border-[3px]";
  return (
    <div className="flex items-end gap-1">
      {piles.map((p) => {
        const visible = Math.min(p.count, 5);
        return (
          <div key={p.v} className="relative" style={{ width: w, height: w + (visible - 1) * step }}>
            {Array.from({ length: visible }).map((_, j) => (
              <div
                key={j}
                className={`absolute left-0 rounded-full border-dashed shadow ${disc} ${p.edge} ${p.bg}`}
                style={{ bottom: j * step }}
              >
                <div className="absolute inset-[2px] rounded-full border border-white/40" />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ModelBadge({ model, thinking }: { model: string; thinking?: boolean }) {
  const premium = model === "gpt-5-nano";
  return (
    <div
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] leading-none ${
        premium
          ? "border-violet-300 bg-gradient-to-r from-violet-100 to-fuchsia-100 text-violet-700"
          : "border-neutral-300 bg-neutral-100 text-neutral-600"
      } ${thinking ? "ring-2 ring-amber-300" : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${premium ? "bg-violet-500" : "bg-emerald-500"}`} />
      {model}
      {premium && !thinking && <span className="text-fuchsia-500">✦</span>}
      {thinking && (
        <span className="ml-0.5 inline-flex gap-0.5">
          {[0, 1, 2].map((k) => (
            <span key={k} className="h-1 w-1 animate-bounce rounded-full bg-amber-500" style={{ animationDelay: `${k * 120}ms` }} />
          ))}
        </span>
      )}
    </div>
  );
}

function Seat({ p, i, game }: { p: Player; i: number; game: Game }) {
  const active = game.to_act === i && game.phase !== "done";
  const winners = game.winner?.indices || [];
  const isWinner = winners.includes(i);
  const thinking = active && !p.is_human && !game.awaiting_human && !p.folded;
  const revealed = game.phase === "done" && !p.folded;
  const role = roleLabel(i, game.dealer);
  return (
    <div className="absolute z-10" style={{ left: SEAT_POS[i].left, top: SEAT_POS[i].top, transform: "translate(-50%,-50%)" }}>
      <div
        className={`relative flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-all duration-500 ${
          isWinner
            ? "winner-glow border-amber-400 bg-amber-50/95"
            : active
              ? "gold-pulse border-amber-400 bg-white/95"
              : "border-amber-900/15 bg-white/85 shadow"
        } ${p.folded ? "opacity-40 grayscale" : ""}`}
      >
        {role && (
          <span
            className={`absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shadow ${
              role === "D"
                ? "border border-neutral-300 bg-white text-neutral-900"
                : role === "SB"
                  ? "bg-sky-500 text-white"
                  : "bg-rose-500 text-white"
            }`}
          >
            {role}
          </span>
        )}
        <div className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
          <span>{p.name}</span>
          {p.is_human && <span className="rounded bg-emerald-600 px-1.5 text-[11px] text-white">you</span>}
          {p.all_in && <span className="rounded bg-red-600 px-1.5 text-[11px] text-white">all-in</span>}
          {isWinner && (
            <span className="rounded bg-gradient-to-r from-amber-400 to-yellow-500 px-1.5 text-[11px] font-bold text-black">winner</span>
          )}
        </div>
        {!p.is_human && <ModelBadge model={MODEL_BY_NAME[p.name] || "gpt-4.1-nano"} thinking={thinking} />}
        <div className="flex items-end gap-1.5">
          <div className="flex gap-1">
            {p.is_human ? (
              <>
                <Card c={p.hole?.[0]} />
                <Card c={p.hole?.[1]} />
              </>
            ) : (
              <>
                <FlipCard c={p.hole?.[0]} faceUp={revealed} />
                <FlipCard c={p.hole?.[1]} faceUp={revealed} />
              </>
            )}
          </div>
          <ChipStack amount={p.chips} mini />
        </div>
      </div>
    </div>
  );
}

function OvalTable({ game, lastLog }: { game: Game; lastLog: string | null }) {
  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-3xl">
      <div
        className="absolute inset-0 rounded-[50%] border-[6px] border-amber-400/50 shadow-2xl"
        style={{ background: "radial-gradient(ellipse at center, #1c7a4d, #08301f)" }}
      />
      <div className="absolute inset-6 rounded-[50%] border border-amber-300/20" />

      <div className="absolute left-1/2 top-1/2 flex w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 px-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/90">{game.phase}</div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={game.board[i] ?? `empty-${i}`} c={game.board[i]} delay={i * 90} />
          ))}
        </div>
        <div className="flex flex-col items-center gap-1">
          {game.pot > 0 && <ChipStack amount={game.pot} />}
          <div key={game.pot} className="pot-bump rounded-full bg-black/45 px-4 py-1 font-mono font-semibold text-amber-300 ring-1 ring-amber-400/30">
            pot {game.pot}
          </div>
        </div>
        {game.winner && (
          <div className="text-center text-base font-bold text-amber-300">
            {game.winner.indices.map((i) => game.players[i].name).join(", ")} win with {game.winner.hand}
          </div>
        )}
      </div>

      {lastLog && (
        <div
          key={lastLog}
          className="toast-in pointer-events-none absolute left-1/2 top-1 z-30 -translate-x-1/2 rounded-full bg-neutral-900/90 px-4 py-1 text-sm font-semibold text-amber-200 shadow-lg ring-1 ring-amber-400/30"
        >
          {lastLog}
        </div>
      )}

      {game.players.map((p, i) =>
        p.bet > 0 ? (
          <div key={`bet-${i}`} className="absolute z-10" style={{ left: BET_POS[i].left, top: BET_POS[i].top, transform: "translate(-50%,-50%)" }}>
            <ChipStack amount={p.bet} mini />
          </div>
        ) : null,
      )}

      {game.players.map((p, i) => (
        <Seat key={i} p={p} i={i} game={game} />
      ))}
    </div>
  );
}

type Transcript = { role: string; text: string; ts: number };
type ToolEvent = { name: string; label: string; ts: number };

function CallTicker() {
  const [feed, setFeed] = useState<{ transcript: Transcript[]; tools: ToolEvent[] }>({ transcript: [], tools: [] });
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/voice/feed`);
        if (r.ok) setFeed(await r.json());
      } catch {
        /* backend not up */
      }
    };
    load();
    const id = setInterval(load, 1000);
    return () => clearInterval(id);
  }, []);
  const lines = feed.transcript.slice(0, 6).reverse();
  return (
    <div className="rounded-2xl border border-indigo-400/30 bg-neutral-950 p-3 shadow">
      <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        <span className="font-semibold text-white">Live call</span>
        <span className="text-[10px] uppercase tracking-widest text-indigo-300">Vapi voice agent</span>
      </div>
      {lines.length === 0 && (
        <div className="py-4 text-center text-xs text-neutral-500">
          Call <span className="font-mono text-indigo-300">{PHONE}</span> — the conversation streams here live.
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {lines.map((t, i) => (
          <div key={i} className={`flex ${t.role === "assistant" ? "justify-start" : "justify-end"}`}>
            <span
              className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs ${
                t.role === "assistant" ? "bg-indigo-500/20 text-indigo-100" : "bg-emerald-500/20 text-emerald-100"
              }`}
            >
              {t.text}
            </span>
          </div>
        ))}
      </div>
      {feed.tools.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
          {feed.tools.slice(0, 5).map((t, i) => (
            <span key={i} className="rounded-md bg-fuchsia-500/15 px-2 py-0.5 font-mono text-[10px] text-fuchsia-300">
              🔧 {t.label}
              {t.name === "get_advice" ? " → MOSS" : ""}
            </span>
          ))}
        </div>
      )}
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
  const count = feed.length;
  const avg = count ? Math.round(feed.reduce((s, e) => s + (e.latency_ms || 0), 0) / count) : 0;
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

      <div className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-xs">
        <span className="text-neutral-400">
          <span className="font-mono text-base font-bold text-fuchsia-300">{count}</span> retrievals
        </span>
        <span className="text-neutral-400">
          avg <span className="font-mono text-base font-bold text-emerald-300">{avg}</span> ms
        </span>
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
                    fast ? "bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_0] shadow-emerald-500/50" : "bg-amber-500/20 text-amber-300"
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

function PoweredBy() {
  return (
    <div className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest text-neutral-400">
      <span>Powered by</span>
      <span className="font-bold text-fuchsia-600">MOSS</span>
      <span className="text-neutral-300">·</span>
      <span className="font-bold text-emerald-600">InsForge</span>
      <span className="text-neutral-300">·</span>
      <span className="font-bold text-indigo-600">Vapi</span>
    </div>
  );
}

export default function Home() {
  const [game, setGame] = useState<Game | null>(null);
  const [raise, setRaise] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hands, setHands] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const prev = useRef<Game | null>(null);

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

  // sound + confetti on state transitions
  useEffect(() => {
    const pg = prev.current;
    prev.current = game;
    if (!game || !pg) return;
    if (game.board.length > pg.board.length) sfx.card();
    if (game.pot > pg.pot) sfx.chip();
    if (game.awaiting_human && !pg.awaiting_human) sfx.turn();
    if (game.players.some((p, i) => p.folded && pg.players[i] && !pg.players[i].folded)) sfx.fold();
    if (game.phase === "done" && pg.phase !== "done") {
      const humanWon = (game.winner?.indices || []).includes(game.human_index);
      sfx.win();
      confetti({
        particleCount: humanWon ? 170 : 80,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#d4af37", "#ff6a00", "#e11d48", "#16a34a", "#ffffff"],
      });
    }
  }, [game]);

  async function newHand() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`${API}/game/new`, { method: "POST" });
      setGame(await r.json());
      setHands((h) => h + 1);
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

  function toggleSound() {
    const v = !soundOn;
    setSoundOn(v);
    setMuted(!v);
    if (v) sfx.chip();
  }

  const myTurn = !!game?.awaiting_human;
  const opts = game?.options || [];
  const lastLog = game && game.log.length ? game.log[game.log.length - 1] : null;

  return (
    <div className="min-h-screen p-6 lg:pr-[404px]">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            Agentic Voice <span className="text-[#c8851a]">Poker</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSound}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
            >
              {soundOn ? "🔊 Sound" : "🔈 Muted"}
            </button>
            {game && (
              <button
                onClick={newHand}
                disabled={busy}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 font-bold text-black shadow transition hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50"
              >
                New hand
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Hand #{hands}</span>
          <PoweredBy />
        </div>

        {!game ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-amber-400/40 bg-gradient-to-b from-amber-50 to-white p-12 text-center shadow-lg">
            <div className="text-3xl font-extrabold text-neutral-900">
              Agentic Voice <span className="text-[#c8851a]">Poker</span>
            </div>
            <p className="max-w-md text-neutral-600">
              Four LLMs at the table. You play your seat <span className="font-semibold">by phone</span> — ask for advice, retrieved
              live from MOSS, then make your move by voice.
            </p>
            <a href={`tel:${PHONE_DIGITS}`} className="font-mono text-lg font-bold text-amber-700">
              📞 {PHONE}
            </a>
            <button
              onClick={newHand}
              disabled={busy}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 text-lg font-bold text-black shadow-lg transition hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50"
            >
              Deal me in
            </button>
          </div>
        ) : (
          <>
            <a
              href={`tel:${PHONE_DIGITS}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-100 to-yellow-50 px-4 py-2.5 text-center shadow-sm transition hover:from-amber-200 hover:to-yellow-100"
            >
              <span className="text-lg">📞</span>
              <span className="text-neutral-700">Call to play your seat:</span>
              <span className="font-mono text-lg font-bold text-amber-700">{PHONE}</span>
            </a>

            <div className="py-10">
              <OvalTable game={game} lastLog={lastLog} />
            </div>

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
            {!myTurn && game.phase !== "done" && <div className="text-center text-sm text-neutral-500">waiting for bots…</div>}

            <CallTicker />

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
