#!/usr/bin/env python3
"""端到端 demo：用真實的 Ollama + 真實的 MCP server 跑一次完整 agent 迴圈。

這條路徑與 NoteSentry app 的 main 行程邏輯一致：
  Ollama(帶 tools) → 模型回 tool_calls → [人類覆核點] → 呼叫 MCP 工具 → 回填 → 續跑。
此 demo 為了自動化，在覆核點一律自動同意，並把該點清楚印出來。

用法：python3 scripts_verify/demo_agent.py "你的問題"
"""
import asyncio, json, os, sys, urllib.request

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

OLLAMA = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODEL = os.environ.get("MODEL", "qwen3.6:27b")

SYSTEM = (
    "你是 NoteSentry，一個完全在本機運作的 MIMIC-III 臨床紀錄探索助理。"
    "你只能透過提供的工具查詢本機 SQLite 資料庫，絕不可捏造數據。"
    "回答使用繁體中文，精簡專業。需要資料時就呼叫對應工具。"
)


def mcp_to_ollama_tools(tools):
    out = []
    for t in tools:
        sch = t.inputSchema or {"type": "object", "properties": {}}
        out.append({
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description or "",
                "parameters": {
                    "type": sch.get("type", "object"),
                    "properties": sch.get("properties", {}),
                    "required": sch.get("required", []),
                },
            },
        })
    return out


def ollama_chat(messages, tools):
    body = json.dumps({"model": MODEL, "messages": messages, "tools": tools, "stream": False}).encode()
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())["message"]


async def main():
    question = sys.argv[1] if len(sys.argv) > 1 else "資料庫裡有哪些類別？各有多少筆？最多的前三類是什麼？"
    print(f"🧑 使用者：{question}\n模型：{MODEL}\n" + "=" * 56)

    params = StdioServerParameters(command="python3", args=["mcp/servers/mimic_mcp_server.py"], env={**os.environ})
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = (await s.list_tools()).tools
            otools = mcp_to_ollama_tools(tools)
            print(f"🔌 已連上 MCP，取得 {len(tools)} 個工具：{[t.name for t in tools]}\n")

            messages = [{"role": "system", "content": SYSTEM},
                        {"role": "user", "content": question}]

            for turn in range(6):
                msg = ollama_chat(messages, otools)
                messages.append(msg)
                calls = msg.get("tool_calls") or []
                if not calls:
                    print("🤖 最終回答：\n" + (msg.get("content") or "(空)"))
                    return
                for c in calls:
                    fn = c["function"]
                    name, args = fn["name"], fn.get("arguments", {})
                    if isinstance(args, str):
                        try: args = json.loads(args)
                        except Exception: args = {}
                    print(f"🔔 [人類覆核點] 模型要求呼叫工具：{name}  參數={json.dumps(args, ensure_ascii=False)}")
                    print("    → (demo 自動同意，實際 app 會等你按『同意』)")
                    res = await s.call_tool(name, args)
                    text = res.content[0].text if res.content else ""
                    preview = text.replace("\n", " ")[:120]
                    print(f"    ← 工具回傳（前 120 字）：{preview}\n")
                    messages.append({"role": "tool", "content": text})

            print("⚠️ 達到回合上限。")


if __name__ == "__main__":
    asyncio.run(main())
