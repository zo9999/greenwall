"""One-time: (re)build the poker strategy index in MOSS. Run: python3 seed_moss.py"""
import asyncio
import os

from moss import MossClient
from moss_core import DocumentInfo

from strategy_corpus import CORPUS

INDEX = "poker_strategy"


async def main():
    client = MossClient(os.environ["MOSS_PROJECT_ID"], os.environ["MOSS_API_KEY"])
    for stale in ("smoke_test", INDEX):
        try:
            await client.delete_index(stale)
            print(f"deleted existing index: {stale}")
        except Exception:
            pass
    docs = [DocumentInfo(id=d["id"], text=d["text"], metadata={"street": d["street"]}) for d in CORPUS]
    await client.create_index(INDEX, docs)
    print(f"indexed {len(docs)} strategy snippets into '{INDEX}'")
    await client.load_index(INDEX)
    from moss import QueryOptions
    res = await client.query(INDEX, "I have top pair on the flop facing a bet, what do I do?", QueryOptions(top_k=3))
    print("sanity query ->")
    for d in res.docs:
        print(f"  [{d.score:.3f}] ({d.metadata.get('street')}) {d.text[:80]}...")


if __name__ == "__main__":
    asyncio.run(main())
