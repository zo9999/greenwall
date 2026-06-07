import os

from flask import Flask, jsonify, request
from flask_cors import CORS

import engine
import store
import voice

app = Flask(__name__)
CORS(app)


@app.route("/")
def index():
    return jsonify({"ok": True, "service": "voice-poker"})


@app.post("/game/new")
def game_new():
    row = store.new_game(engine.deal_hand())
    return jsonify(engine.public_view(row["state"]))


@app.get("/game/state")
def game_state():
    row = store.get_current()
    if not row:
        return jsonify({"error": "no game"}), 404
    return jsonify(engine.public_view(row["state"]))


@app.post("/game/action")
def game_action():
    row = store.get_current()
    if not row:
        return jsonify({"error": "no game"}), 404
    state = row["state"]
    data = request.get_json(force=True, silent=True) or {}
    ok, msg = engine.human_action(state, data.get("action"), int(data.get("amount") or 0))
    if not ok:
        return jsonify({"error": msg}), 400
    store.save_state(row["id"], state)
    return jsonify(engine.public_view(state))


@app.post("/vapi")
def vapi_webhook():
    """Single webhook for all Vapi tool calls."""
    data = request.get_json(force=True, silent=True) or {}
    results = []
    for cid, name, args in voice.parse_tool_calls(data):
        try:
            result = voice.dispatch(name, args)
        except Exception as e:
            result = f"Sorry, something went wrong: {e}"
        results.append({"toolCallId": cid, "result": result})
    return jsonify({"results": results})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
