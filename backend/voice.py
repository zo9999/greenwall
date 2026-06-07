"""Voice-agent tool handlers (called by Vapi). All return speakable strings.

The three tools mirror the plan: read hand state (a struct lookup), get strategy
advice (MOSS retrieval), and submit an action (with the agent confirming first).
"""
import collections
import json
import time

import advice
import engine
import store

_TRANSCRIPT = collections.deque(maxlen=40)  # live phone transcript, newest first
_TOOLS = collections.deque(maxlen=40)  # agent tool-calls, newest first


def _speak_cards(cards):
    return " and ".join(advice.card_words(c) for c in cards)


def speak_state(state):
    me = state["players"][state["human_index"]]
    to_call = max(0, state["current_bet"] - me["bet"])
    board = ", ".join(advice.card_words(c) for c in state["board"]) or "no community cards yet"
    if state["phase"] == "done" and state["winner"]:
        names = ", ".join(state["players"][i]["name"] for i in state["winner"]["indices"])
        return f"The hand is over. {names} won with {state['winner']['hand']}. Start a new hand on the screen to play again."
    parts = [
        f"It's the {state['phase']}.",
        f"Your cards are {_speak_cards(me['hole'])}.",
        f"The board is {board}.",
        f"The pot is {state['pot']} chips. You have {me['chips']} chips.",
    ]
    if state["awaiting_human"]:
        options = engine.legal_options(state, state["human_index"])
        parts.append("It costs nothing to check." if to_call == 0 else f"It costs {to_call} chips to call.")
        parts.append(f"You can {', '.join(options)}. What would you like to do?")
    else:
        parts.append("It's not your turn yet; the bots are still acting.")
    return " ".join(parts)


def handle_get_state():
    row = store.get_current()
    if not row:
        return "No hand is in progress. Start a new hand on the screen first."
    return speak_state(row["state"])


def handle_get_advice():
    row = store.get_current()
    if not row:
        return "No hand is in progress yet."
    a = advice.advise(row["state"])
    out = [a["situation"], f"My read: lean towards {a['recommendation']}. {a['reasoning']}"]
    if a["strategy"]:
        out.append("Relevant strategy: " + a["strategy"][0]["text"])
    return " ".join(out)


def handle_submit_action(args):
    row = store.get_current()
    if not row:
        return "No hand is in progress to act on."
    state = row["state"]
    action = str(args.get("action", "")).lower().strip()
    amount = int(args.get("amount") or 0)
    ok, msg = engine.human_action(state, action, amount)
    if not ok:
        return f"That move isn't allowed right now: {msg}."
    store.save_state(row["id"], state)
    confirm = f"Done. You chose {action}" + (f" to {amount}." if action == "raise" else ".")
    return confirm + " " + speak_state(state)


def record_message(data):
    """Capture Vapi transcript events for the live on-screen feed."""
    msg = data.get("message", data) or {}
    if msg.get("type") == "transcript" and msg.get("transcriptType") == "final":
        text = (msg.get("transcript") or "").strip()
        if text:
            _TRANSCRIPT.appendleft({"role": msg.get("role", "user"), "text": text, "ts": time.time()})


def record_tool(name, args):
    label = name
    if name == "submit_action":
        a = args or {}
        label = "submit_action: " + str(a.get("action", "")) + (f" {a.get('amount')}" if a.get("action") == "raise" else "")
    _TOOLS.appendleft({"name": name, "label": label, "ts": time.time()})


def get_voice_feed():
    return {"transcript": list(_TRANSCRIPT), "tools": list(_TOOLS)}


def dispatch(name, args):
    if name == "get_state":
        return handle_get_state()
    if name == "get_advice":
        return handle_get_advice()
    if name == "submit_action":
        return handle_submit_action(args or {})
    return f"Unknown tool: {name}"


def parse_tool_calls(data):
    """Extract (id, name, args) tuples from a Vapi webhook body (robust to shape)."""
    msg = data.get("message", data)
    calls = msg.get("toolCallList") or msg.get("toolCalls") or data.get("toolCallList") or []
    out = []
    for c in calls:
        cid = c.get("id")
        name = c.get("name") or c.get("function", {}).get("name")
        args = c.get("arguments")
        if args is None:
            args = c.get("function", {}).get("arguments")
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = {}
        out.append((cid, name, args or {}))
    return out
