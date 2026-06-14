#!/usr/bin/env python3
"""端到端 demo：同時連上多個 MCP server（讀 config.json），跑完整 agent 迴圈。

這條路徑與 NoteSentry app 重構後的 main 行程一致：合併多支 server 的工具、
依工具名路由到對的 server、模型自選工具 → 人類覆核點 → 呼叫 → 回填 → 續跑。
覆核點為了自動化一律自動同意，並印出該工具來自哪一支 server。

用法：python3 scripts_verify/demo_multi.py "你的問題"
"""
import asyncio, json, os, sys, urllib.request
from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

CFG = json.load(open("config.json", encoding="utf-8"))
OLLAMA = CFG.get("ollamaUrl", "http://localhost:11434")
MODEL = os.environ.get("MODEL", CFG.get("model", "qwen3.6:27b"))

SYSTEM = (
    "你是 NoteSentry，一個完全在本機運作的臨床紀錄探索與輔助助理。\n"
    "【取得資料的唯一方式】需要任何資料時必須直接發出結構化工具呼叫（function call），"
    "嚴禁在文字裡描述『我將呼叫某工具/請核可/SQL』，嚴禁杜撰資料表、欄位或工具名稱；"
    "你只能使用下方列出的工具。沒有工具能取得就如實說無法得知，不可捏造。\n"
    "回答使用繁體中文、精簡專業；取得結果後再整理成答案。"
)


def ollama_chat(messages, tools):
    body = json.dumps({
        "model": MODEL, "messages": messages, "tools": tools, "stream": False,
        "options": {"temperature": 0.3}
    }).encode()
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as r:
        return json.loads(r.read())["message"]


async def main():
    question = sys.argv[1] if len(sys.argv) > 1 else (
        "一位 68 歲男性，主訴胸痛合併冒冷汗，生命徵象 SpO2 89、心跳 124、血壓 88/60、GCS 15。"
        "請評估建議的檢傷級別並說明理由。"
    )
    print(f"🧑 使用者：{question}\n模型：{MODEL}\n" + "=" * 60)

    servers = [s for s in CFG["mcpServers"] if s.get("enabled", True)]
    async with AsyncExitStack() as stack:
        sessions = {}      # serverId -> ClientSession
        route = {}         # toolName -> (serverId, serverName)
        otools = []        # Ollama tool 定義
        for srv in servers:
            params = StdioServerParameters(
                command=CFG.get("pythonPath", "python3"),
                args=[srv["scriptPath"]],
                env={**os.environ, "MIMIC_DB_PATH": CFG.get("dbPath", "mimic_notes.db")},
            )
            r, w = await stack.enter_async_context(stdio_client(params))
            sess = await stack.enter_async_context(ClientSession(r, w))
            await sess.initialize()
            sessions[srv["id"]] = sess
            tools = (await sess.list_tools()).tools
            for t in tools:
                route[t.name] = (srv["id"], srv["name"])
                sch = t.inputSchema or {"type": "object", "properties": {}}
                otools.append({"type": "function", "function": {
                    "name": t.name, "description": t.description or "",
                    "parameters": {"type": sch.get("type", "object"),
                                   "properties": sch.get("properties", {}),
                                   "required": sch.get("required", [])}}})
            print(f"🔌 連上「{srv['name']}」：{[t.name for t in tools]}")
        print(f"   共 {len(otools)} 個工具可用\n")

        # 把實際可用工具清單接進 system prompt（避免臆造不存在的工具/資料表）
        tool_lines = "\n".join(
            f"- {o['function']['name']}：{o['function']['description']}" for o in otools
        )
        system = SYSTEM + "\n\n【你目前可用的工具，僅此而已】\n" + tool_lines
        messages = [{"role": "system", "content": system}, {"role": "user", "content": question}]
        for _ in range(8):
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
                sid, sname = route.get(name, ("?", "?"))
                print(f"🔔 [人類覆核點] 呼叫 {name}  來源server=「{sname}」  參數={json.dumps(args, ensure_ascii=False)}")
                print("    → (demo 自動同意)")
                res = await sessions[sid].call_tool(name, args)
                text = res.content[0].text if res.content else ""
                print(f"    ← 回傳（前 140 字）：{text.replace(chr(10),' ')[:140]}\n")
                messages.append({"role": "tool", "content": text})
        print("⚠️ 達到回合上限。")


if __name__ == "__main__":
    asyncio.run(main())
