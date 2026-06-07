"""Strategy advice for the voice agent. Retrieves from MOSS and adds a quick read.

Game state stays in plain memory (a struct lookup); strategy is the fuzzy,
big knowledge base, so that part lives in MOSS and is retrieved live.
"""
import asyncio
import os

import engine

INDEX = "poker_strategy"
RANK_WORD = {"A": "Ace", "K": "King", "Q": "Queen", "J": "Jack", "T": "Ten"}
SUIT_WORD = {"s": "spades", "h": "hearts", "d": "diamonds", "c": "clubs"}

_client = None
_loaded = False


def _get_client():
    global _client
    if _client is None:
        from moss import MossClient
        _client = MossClient(os.environ["MOSS_PROJECT_ID"], os.environ["MOSS_API_KEY"])
    return _client


async def _retrieve(query, top_k):
    global _loaded
    from moss import QueryOptions
    client = _get_client()
    if not _loaded:
        await client.load_index(INDEX)
        _loaded = True
    res = await client.query(INDEX, query, QueryOptions(top_k=top_k))
    return [{"text": d.text, "score": round(float(d.score), 3), "street": d.metadata.get("street")} for d in res.docs]


def retrieve(query, top_k=3):
    if not os.environ.get("MOSS_API_KEY"):
        return []
    try:
        return asyncio.run(_retrieve(query, top_k))
    except Exception:
        return []


def card_words(c):
    rank = RANK_WORD.get(c[0], c[0])
    return f"{rank} of {SUIT_WORD.get(c[1], c[1])}"


def advise(state):
    me = state["players"][state["human_index"]]
    to_call = max(0, state["current_bet"] - me["bet"])
    hole = " and ".join(card_words(c) for c in me["hole"])
    board = ", ".join(card_words(c) for c in state["board"]) or "no community cards yet"
    # Query MOSS by the strategic situation, not raw card names, so retrieval
    # returns street- and spot-relevant advice rather than card-name matches.
    hand_desc = _describe_hand(state, me)
    pressure = "facing a bet" if to_call > 0 else "with no bet to call"
    query = (
        f"On the {state['phase']} I have {hand_desc}, {pressure}. "
        f"It costs {to_call} to call into a pot of {state['pot']}. Should I fold, call, check, or raise?"
    )
    snippets = retrieve(query, top_k=3)
    rec, reason = _heuristic(state, me, to_call)
    return {
        "situation": f"It's the {state['phase']}. You hold {hole}. The board is {board}. "
        f"The pot is {state['pot']} and it costs {to_call} to call.",
        "recommendation": rec,
        "reasoning": reason,
        "strategy": snippets,
    }


def _describe_hand(state, me):
    if state["board"]:
        cat = engine.best_hand(me["hole"] + state["board"])[0]
        names = {8: "a straight flush", 7: "four of a kind", 6: "a full house", 5: "a flush",
                 4: "a straight", 3: "three of a kind", 2: "two pair", 1: "a pair",
                 0: "no made hand, just high card"}
        desc = names[cat]
        if cat == 1:  # distinguish top pair vs weak pair
            board_ranks = [engine.RANK_VAL[c[0]] for c in state["board"]]
            hole_ranks = [engine.RANK_VAL[c[0]] for c in me["hole"]]
            if any(h in board_ranks and h >= max(board_ranks) for h in hole_ranks):
                desc = "top pair"
        return desc
    r0, r1 = engine.RANK_VAL[me["hole"][0][0]], engine.RANK_VAL[me["hole"][1][0]]
    if r0 == r1:
        return "a big pocket pair" if r0 >= 10 else "a small pocket pair"
    if max(r0, r1) >= 13 and min(r0, r1) >= 10:
        return "two strong high cards"
    if max(r0, r1) >= 12:
        return "one high card"
    return "a weak unpaired hand"


def _heuristic(state, me, to_call):
    """A rough read to anchor the agent; MOSS snippets carry the nuance."""
    if state["board"]:
        category = engine.best_hand(me["hole"] + state["board"])[0]
        if category >= 2:
            return ("raise" if to_call == 0 else "call/raise", "You have a strong made hand (two pair or better) — play it fast for value.")
        if category == 1:
            return ("check/call", "You have a pair — reasonable but not strong; keep the pot manageable.")
        return ("check/fold", "You have not connected with the board; avoid putting in chips without a draw.")
    # preflop read from hole strength
    r0, r1 = engine.RANK_VAL[me["hole"][0][0]], engine.RANK_VAL[me["hole"][1][0]]
    pair = r0 == r1
    high = max(r0, r1)
    if pair and high >= 10:
        return ("raise", "A big pocket pair — raise for value.")
    if pair or (high >= 13 and min(r0, r1) >= 10):
        return ("raise/call", "A solid starting hand — playable, lean aggressive in position.")
    if high >= 12:
        return ("call", "A speculative high-card hand — proceed cautiously.")
    return ("fold" if to_call > 0 else "check", "A weak starting hand — fold to action.")
