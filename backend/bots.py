import json
import os

import engine

_client = None


def client():
    global _client
    if _client is None:
        from openai import OpenAI
        _client = OpenAI()
    return _client


def decide(state, idx):
    """Return (action, amount) for a bot. Falls back to check/call on any problem."""
    options = engine.legal_options(state, idx)
    fallback = ("check", 0) if "check" in options else ("call", 0)
    if not os.environ.get("OPENAI_API_KEY"):
        return fallback
    p = state["players"][idx]
    to_call = max(0, state["current_bet"] - p["bet"])
    active = sum(1 for q in state["players"] if not q["folded"])
    prompt = (
        f"You are {p['name']}, a bot in 4-handed No-Limit Texas Hold'em. Decide your move.\n"
        f"Your hole cards: {' '.join(p['hole'])}\n"
        f"Community board: {' '.join(state['board']) or '(none yet)'}\n"
        f"Street: {state['phase']}. Players still in: {active}.\n"
        f"Pot: {state['pot']}. Your stack: {p['chips']}. You have already put in {p['bet']} this street.\n"
        f"To call: {to_call}. Minimum raise-to: {state['current_bet'] + engine.BB_AMT}.\n"
        f"Legal actions: {options}.\n"
        'Reply with ONLY compact JSON like {"action":"call","amount":0}. '
        'For a raise, "amount" is the TOTAL chips you want your bet to reach.\n'
        "Play sensibly: fold weak hands facing real bets, value-raise strong hands, "
        "call with reasonable holdings and draws."
    )
    try:
        resp = client().chat.completions.create(
            model="gpt-4.1-nano",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
            timeout=8,
        )
        data = json.loads(resp.choices[0].message.content)
        action = str(data.get("action", "")).lower().strip()
        amount = int(data.get("amount") or 0)
    except Exception:
        return fallback
    if action not in options:
        return fallback
    if action == "raise":
        amount = max(amount, state["current_bet"] + engine.BB_AMT)
    return (action, amount)
