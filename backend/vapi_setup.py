"""Create/refresh the Vapi assistant + tools + phone number. Run once after deploy.

Env needed: VAPI_TOKEN (private key), BACKEND_URL (public backend base).
"""
import os

import requests

VAPI = "https://api.vapi.ai"
TOKEN = os.environ["VAPI_TOKEN"]
BACKEND = os.environ.get("BACKEND_URL", "https://voice-poker-012c477d-cb51-431e-b0c5-aafac6e47303.fly.dev").rstrip("/")
WEBHOOK = f"{BACKEND}/vapi"
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

SYSTEM = (
    "You are a poker assistant on a live phone call. The user plays one seat in a 4-player "
    "Texas Hold'em game against bots. You have three tools: get_state (read the current hand), "
    "get_advice (live strategy advice), and submit_action (perform the user's move). "
    "Rules: "
    "1) When they ask what's happening or what their cards are, call get_state. "
    "2) When they ask what to do, or whether to raise, call, check, or fold, call get_advice and relay it naturally. "
    "3) Before performing ANY move with submit_action, ALWAYS read back the exact action and amount "
    "and get an explicit yes first. For example: 'Raising to 200 — want me to confirm that?'. "
    "Only call submit_action after they clearly confirm. A raise REQUIRES an amount; if it's unclear, ask. "
    "4) Keep replies short and conversational — this is a phone call. After a move, briefly say what happened."
)


def tool(name, description, properties=None, required=None):
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": properties or {}, "required": required or []},
        },
        "server": {"url": WEBHOOK},
    }


TOOLS = [
    tool("get_state", "Read the current poker hand: the user's cards, the board, the pot, whose turn it is, and what actions are legal."),
    tool("get_advice", "Get strategy advice for the current spot (whether to fold, call, check, or raise), retrieved live from a poker strategy knowledge base."),
    tool(
        "submit_action",
        "Perform the user's poker move. Only call after the user confirms.",
        {
            "action": {"type": "string", "enum": ["fold", "check", "call", "raise", "allin"], "description": "The move to make."},
            "amount": {"type": "number", "description": "For a raise, the total chips to raise TO. Omit otherwise."},
        },
        ["action"],
    ),
]


def create_assistant():
    body = {
        "name": "Voice Poker Coach",
        "firstMessage": "Hey, you're at the poker table. Want your hand, or a read on what to do?",
        "model": {
            "provider": "openai",
            "model": "gpt-4.1-nano",
            "messages": [{"role": "system", "content": SYSTEM}],
            "tools": TOOLS,
        },
        "voice": {"provider": "openai", "voiceId": "alloy"},
        "transcriber": {"provider": "deepgram", "model": "nova-2", "language": "en"},
        "server": {"url": WEBHOOK},
        "serverMessages": ["transcript", "tool-calls", "status-update", "conversation-update", "end-of-call-report"],
    }
    r = requests.post(f"{VAPI}/assistant", headers=H, json=body, timeout=30)
    r.raise_for_status()
    return r.json()["id"]


def create_phone_number(assistant_id):
    area = os.environ.get("DESIRED_AREA_CODE", "415")
    r = requests.post(
        f"{VAPI}/phone-number",
        headers=H,
        json={
            "provider": "vapi",
            "assistantId": assistant_id,
            "name": "Voice Poker line",
            "numberDesiredAreaCode": area,
        },
        timeout=30,
    )
    return r


if __name__ == "__main__":
    print(f"webhook -> {WEBHOOK}")
    aid = os.environ.get("ASSISTANT_ID")
    if aid:
        print(f"reusing assistant: {aid}")
    else:
        aid = create_assistant()
        print(f"assistant created: {aid}")
    r = create_phone_number(aid)
    if r.status_code < 300:
        data = r.json()
        print(f"phone number: {data.get('number')} (id {data.get('id')})")
    else:
        print(f"phone number FAILED [{r.status_code}]: {r.text[:400]}")
        print("(Assistant is ready; allocate a number in the Vapi dashboard and attach this assistant.)")
