import random
from itertools import combinations

RANKS = "23456789TJQKA"
SUITS = "shdc"
RANK_VAL = {r: i + 2 for i, r in enumerate(RANKS)}

SB_AMT = 10
BB_AMT = 20
START_CHIPS = 1000
NUM_PLAYERS = 4
HUMAN = 0
NAMES = ["You", "Ada", "Boris", "Cleo"]

HAND_NAMES = {
    8: "straight flush", 7: "four of a kind", 6: "full house", 5: "flush",
    4: "straight", 3: "three of a kind", 2: "two pair", 1: "pair", 0: "high card",
}


def new_deck():
    deck = [r + s for r in RANKS for s in SUITS]
    random.shuffle(deck)
    return deck


def deal_hand():
    deck = new_deck()
    players = []
    for i in range(NUM_PLAYERS):
        players.append({
            "name": NAMES[i],
            "is_human": i == HUMAN,
            "chips": START_CHIPS,
            "hole": [deck.pop(), deck.pop()],
            "bet": 0,
            "folded": False,
            "all_in": False,
            "acted": False,
        })
    state = {
        "phase": "preflop",
        "deck": deck,
        "board": [],
        "pot": 0,
        "current_bet": BB_AMT,
        "dealer": 0,
        "to_act": 3 % NUM_PLAYERS,
        "players": players,
        "human_index": HUMAN,
        "log": [],
        "winner": None,
        "awaiting_human": False,
    }
    post_blind(state, 1, SB_AMT)
    post_blind(state, 2, BB_AMT)
    log(state, f"Blinds: {players[1]['name']} {SB_AMT}, {players[2]['name']} {BB_AMT}")
    step(state)
    return state


def log(state, msg):
    state["log"] = (state["log"] + [msg])[-30:]


def post_blind(state, idx, amount):
    commit(state, state["players"][idx], amount)


def commit(state, p, pay):
    pay = max(0, min(pay, p["chips"]))
    p["chips"] -= pay
    p["bet"] += pay
    state["pot"] += pay
    if p["chips"] == 0:
        p["all_in"] = True


def can_act(state, idx):
    p = state["players"][idx]
    return not p["folded"] and not p["all_in"]


def needs_action(state, idx):
    p = state["players"][idx]
    return can_act(state, idx) and (not p["acted"] or p["bet"] < state["current_bet"])


def active_players(state):
    return [i for i, p in enumerate(state["players"]) if not p["folded"]]


def next_actor(state, from_idx):
    for s in range(1, NUM_PLAYERS + 1):
        idx = (from_idx + s) % NUM_PLAYERS
        if needs_action(state, idx):
            return idx
    return None


def next_active_after(state, idx):
    for s in range(1, NUM_PLAYERS + 1):
        j = (idx + s) % NUM_PLAYERS
        if can_act(state, j):
            return j
    return idx


def betting_done(state):
    return next_actor(state, state["to_act"]) is None and not needs_action(state, state["to_act"])


def step(state):
    """Run bot actions until it's the human's turn or the hand ends."""
    guard = 0
    while True:
        guard += 1
        if guard > 500 or state["phase"] in ("done",):
            return
        if len(active_players(state)) == 1:
            end_hand(state)
            return
        if betting_done(state):
            advance_street(state)
            if state["phase"] == "showdown":
                end_hand(state)
                return
            continue
        idx = state["to_act"]
        if not needs_action(state, idx):
            idx = next_actor(state, idx)
            if idx is None:
                continue
            state["to_act"] = idx
        if state["players"][idx]["is_human"]:
            state["awaiting_human"] = True
            return
        bot_act(state, idx)
        state["to_act"] = (idx + 1) % NUM_PLAYERS


def advance_street(state):
    for p in state["players"]:
        p["bet"] = 0
        p["acted"] = False
    state["current_bet"] = 0
    order = ["preflop", "flop", "turn", "river", "showdown"]
    nxt = order[order.index(state["phase"]) + 1]
    state["phase"] = nxt
    if nxt == "flop":
        state["deck"].pop()
        state["board"] += [state["deck"].pop() for _ in range(3)]
    elif nxt in ("turn", "river"):
        state["deck"].pop()
        state["board"].append(state["deck"].pop())
    if nxt != "showdown":
        log(state, f"-- {nxt} -- {' '.join(state['board'])}")
        state["to_act"] = next_active_after(state, state["dealer"])


def bot_act(state, idx):
    import bots
    action, amount = bots.decide(state, idx)
    apply(state, idx, action, amount)


def apply(state, idx, action, amount=0):
    p = state["players"][idx]
    to_call = state["current_bet"] - p["bet"]
    if action == "fold":
        p["folded"] = True
        log(state, f"{p['name']} folds")
    elif action == "check" and to_call <= 0:
        log(state, f"{p['name']} checks")
    elif action == "call" or (action == "check" and to_call > 0):
        pay = min(to_call, p["chips"])
        commit(state, p, pay)
        log(state, f"{p['name']} calls {pay}" if pay > 0 else f"{p['name']} checks")
    elif action == "raise":
        target = max(amount, state["current_bet"] + BB_AMT)
        target = min(target, p["bet"] + p["chips"])
        commit(state, p, target - p["bet"])
        raise_to(state, idx, p)
        log(state, f"{p['name']} raises to {p['bet']}")
    elif action == "allin":
        commit(state, p, p["chips"])
        if p["bet"] > state["current_bet"]:
            raise_to(state, idx, p)
        log(state, f"{p['name']} all-in {p['bet']}")
    p["acted"] = True
    state["awaiting_human"] = False


def raise_to(state, idx, p):
    state["current_bet"] = p["bet"]
    for j, q in enumerate(state["players"]):
        if j != idx and not q["folded"] and not q["all_in"]:
            q["acted"] = False


def end_hand(state):
    contenders = active_players(state)
    if len(contenders) == 1:
        w = contenders[0]
        state["players"][w]["chips"] += state["pot"]
        state["winner"] = {"indices": [w], "hand": "others folded"}
        log(state, f"{state['players'][w]['name']} wins {state['pot']} (others folded)")
    else:
        best = None
        winners = []
        for i in contenders:
            score = best_hand(state["players"][i]["hole"] + state["board"])
            if best is None or score > best:
                best, winners = score, [i]
            elif score == best:
                winners.append(i)
        share = state["pot"] // len(winners)
        for i in winners:
            state["players"][i]["chips"] += share
        state["players"][winners[0]]["chips"] += state["pot"] - share * len(winners)
        names = ", ".join(state["players"][i]["name"] for i in winners)
        state["winner"] = {"indices": winners, "hand": HAND_NAMES[best[0]]}
        log(state, f"{names} win {state['pot']} with {HAND_NAMES[best[0]]}")
    state["pot"] = 0
    state["phase"] = "done"
    state["awaiting_human"] = False


def best_hand(cards):
    return max(score5(c) for c in combinations(cards, 5))


def score5(cards):
    vals = sorted((RANK_VAL[c[0]] for c in cards), reverse=True)
    is_flush = len({c[1] for c in cards}) == 1
    high_straight = straight_high(vals)
    counts = {}
    for v in vals:
        counts[v] = counts.get(v, 0) + 1
    by_count = sorted(counts.items(), key=lambda kv: (kv[1], kv[0]), reverse=True)
    shape = [c for _, c in by_count]
    ordered = [v for v, _ in by_count]
    if is_flush and high_straight:
        return (8, high_straight)
    if shape[0] == 4:
        return (7, ordered[0], ordered[1])
    if shape[0] == 3 and shape[1] >= 2:
        return (6, ordered[0], ordered[1])
    if is_flush:
        return (5, *vals)
    if high_straight:
        return (4, high_straight)
    if shape[0] == 3:
        return (3, ordered[0], *[v for v in vals if v != ordered[0]][:2])
    if shape[0] == 2 and shape[1] == 2:
        kick = max(v for v in vals if v not in (ordered[0], ordered[1]))
        return (2, ordered[0], ordered[1], kick)
    if shape[0] == 2:
        return (1, ordered[0], *[v for v in vals if v != ordered[0]][:3])
    return (0, *vals)


def straight_high(vals):
    d = sorted(set(vals), reverse=True)
    if {14, 5, 4, 3, 2}.issubset(set(vals)):
        wheel = 5
    else:
        wheel = 0
    for i in range(len(d) - 4):
        window = d[i:i + 5]
        if window[0] - window[4] == 4:
            return window[0]
    return wheel


def legal_options(state, idx):
    p = state["players"][idx]
    to_call = state["current_bet"] - p["bet"]
    opts = ["fold"]
    opts.append("check" if to_call <= 0 else "call")
    if p["chips"] > max(0, to_call):
        opts.append("raise")
    opts.append("allin")
    return opts


def legal_human_options(state):
    return legal_options(state, state["human_index"])


def human_action(state, action, amount=0):
    if state["phase"] == "done":
        return False, "hand is over"
    idx = state["human_index"]
    if not state["awaiting_human"] or state["to_act"] != idx:
        return False, "not your turn"
    opts = legal_human_options(state)
    if action == "check" and "call" in opts:
        action = "call"
    elif action == "call" and "check" in opts:
        action = "check"
    if action not in opts:
        return False, f"illegal action; allowed: {opts}"
    apply(state, idx, action, amount)
    step(state)
    return True, "ok"


def public_view(state):
    reveal = state["phase"] == "done"
    players = []
    for p in state["players"]:
        show = p["is_human"] or (reveal and not p["folded"])
        players.append({
            "name": p["name"], "is_human": p["is_human"], "chips": p["chips"],
            "bet": p["bet"], "folded": p["folded"], "all_in": p["all_in"],
            "hole": p["hole"] if show else None,
        })
    human = state["players"][state["human_index"]]
    to_call = max(0, state["current_bet"] - human["bet"])
    return {
        "phase": state["phase"],
        "board": state["board"],
        "pot": state["pot"],
        "current_bet": state["current_bet"],
        "to_act": state["to_act"],
        "awaiting_human": state["awaiting_human"],
        "human_index": state["human_index"],
        "dealer": state["dealer"],
        "players": players,
        "log": state["log"],
        "winner": state["winner"],
        "to_call": to_call,
        "min_raise_to": state["current_bet"] + BB_AMT,
        "options": legal_human_options(state) if state["awaiting_human"] else [],
    }
