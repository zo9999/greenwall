"""Texas Hold'em strategy snippets indexed in MOSS for live retrieval.

Each entry: id, text (the advice), street (preflop/flop/turn/river/general).
Keep snippets short and self-contained so retrieval returns clean, speakable advice.
"""

CORPUS = [
    # --- Preflop ---
    {"id": "pf1", "street": "preflop", "text": "Premium pairs (Aces, Kings, Queens) and Ace-King should almost always be raised or re-raised preflop for value. Build the pot while you are ahead."},
    {"id": "pf2", "street": "preflop", "text": "Position is power. Play more hands in late position (button, cutoff) and fewer from early position, because acting last lets you control the pot."},
    {"id": "pf3", "street": "preflop", "text": "Small and medium pocket pairs want to see a cheap flop to try to hit a set. Call a single raise if the price is right, but fold to large re-raises."},
    {"id": "pf4", "street": "preflop", "text": "Suited connectors like 8-9 suited play well multiway and in position. Call to set-mine and flop big draws, but do not commit many chips preflop."},
    {"id": "pf5", "street": "preflop", "text": "Facing a raise with a marginal hand out of position, folding is usually correct. Calling out of position bleeds chips over time."},
    {"id": "pf6", "street": "preflop", "text": "When you are the big blind facing a single small raise, you can defend fairly wide because you are getting a good price to call."},
    {"id": "pf7", "street": "preflop", "text": "Three-betting (re-raising) with strong hands gets value and with some suited hands applies pressure. Avoid flat-calling every raise; aggression wins pots."},
    {"id": "pf8", "street": "preflop", "text": "Ace-Queen and Ace-Jack are strong but get dominated by Ace-King. Raise them, but be cautious facing heavy re-raise action."},
    {"id": "pf9", "street": "preflop", "text": "With a short stack, play tight and push strong hands all-in rather than making small raises that pot-commit you with weak holdings."},
    {"id": "pf10", "street": "preflop", "text": "Offsuit trash like 7-2, 9-4, J-3 should be folded. Do not get attached to weak unconnected cards just to see a flop."},

    # --- Flop ---
    {"id": "fl1", "street": "flop", "text": "The preflop raiser should often make a continuation bet on the flop, especially on dry boards that are unlikely to have helped a caller."},
    {"id": "fl2", "street": "flop", "text": "On a wet, draw-heavy board (connected or two of a suit), bet larger with strong hands to charge draws and deny equity."},
    {"id": "fl3", "street": "flop", "text": "Top pair with a good kicker is usually strong enough to bet for value on the flop, but slow down if facing heavy resistance on later streets."},
    {"id": "fl4", "street": "flop", "text": "Flopping a flush draw or open-ended straight draw gives you many outs. Semi-bluffing these draws lets you win now or improve to the best hand."},
    {"id": "fl5", "street": "flop", "text": "When you completely miss the flop and have no draw, give up cheaply. Do not fire bluffs into multiple opponents without equity."},
    {"id": "fl6", "street": "flop", "text": "Flopping a set (three of a kind) is a monster. Bet and raise to build the pot; you are rarely behind and want money in now."},
    {"id": "fl7", "street": "flop", "text": "On a paired board, be cautious: someone may have trips or a full house. Pot control with medium hands."},
    {"id": "fl8", "street": "flop", "text": "Checking back a marginal hand in position keeps the pot small and lets you realize your equity cheaply."},

    # --- Turn ---
    {"id": "tn1", "street": "turn", "text": "The turn is where pots get big. Continue betting (double-barrel) when you have a strong hand or a strong draw, but slow down with weak made hands."},
    {"id": "tn2", "street": "turn", "text": "If a scare card completes an obvious draw, evaluate whether your opponent's calling range got there. Pump the brakes with one-pair hands."},
    {"id": "tn3", "street": "turn", "text": "With a big draw on the turn, semi-bluffing still works, but the price to chase is higher now. Use pot odds to decide whether a pure call is profitable."},
    {"id": "tn4", "street": "turn", "text": "Pot control: checking the turn with a medium-strength hand avoids bloating the pot and getting check-raised off your equity."},

    # --- River ---
    {"id": "rv1", "street": "river", "text": "On the river there are no more cards. Bet your strong hands for value and check or fold your busted draws. Thin value bets win big over time."},
    {"id": "rv2", "street": "river", "text": "Bluff the river only when the story makes sense and your opponent can fold a better hand. Bluffing a calling station is lighting chips on fire."},
    {"id": "rv3", "street": "river", "text": "Facing a river bet with a bluff-catcher, use pot odds: if you only need to be right occasionally to break even, a hero call can be correct."},
    {"id": "rv4", "street": "river", "text": "When you hold the nuts on the river, size up. Many players under-bet huge hands and leave value on the table."},

    # --- General ---
    {"id": "gn1", "street": "general", "text": "Pot odds: compare the cost to call against the total pot. If you must call 20 to win 100, you are getting 5 to 1 and need about 17 percent equity to continue."},
    {"id": "gn2", "street": "general", "text": "Counting outs: a flush draw has 9 outs, an open-ended straight draw has 8. Multiply outs by 2 per remaining card for a rough percentage to improve."},
    {"id": "gn3", "street": "general", "text": "Aggression wins. Betting and raising gives you two ways to win: opponents fold, or you have the best hand. Calling only wins one way."},
    {"id": "gn4", "street": "general", "text": "When in doubt facing a big bet with a weak hand, folding is fine. You do not have to win every pot; saving chips is also winning."},
    {"id": "gn5", "street": "general", "text": "Stack-to-pot ratio matters. With a short effective stack, strong top pairs are happy to get all-in; with deep stacks, be more careful."},
    {"id": "gn6", "street": "general", "text": "Tells and timing aside, fold equity comes from a believable line. Bet sizes that tell a consistent story across streets get more folds."},
    {"id": "gn7", "street": "general", "text": "Do not bluff into multiple opponents lightly. The more players in the pot, the more likely someone has a hand that calls."},
    {"id": "gn8", "street": "general", "text": "Bankroll and tilt control: play your best, fold when beat, and do not chase losses with reckless all-ins. Patience is a long-term edge."},
]
