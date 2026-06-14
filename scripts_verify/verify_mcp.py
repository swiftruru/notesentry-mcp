#!/usr/bin/env python3
"""透過真正的 MCP stdio 協定呼叫四個工具，與 ground_truth.json 逐項比對。

驗證 NoteSentry 的 MCP server 是否正確讀取了完整的 NOTEEVENTS.csv 資料。
"""
import asyncio, json, os, sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

GT_PATH = os.path.join("scripts_verify", "ground_truth.json")
DB_PATH = os.environ.get("MIMIC_DB_PATH", "mimic_notes.db")

PASS = "✅ PASS"
FAIL = "❌ FAIL"
results = []

def check(name, ok, detail=""):
    results.append(ok)
    print(f"{PASS if ok else FAIL}  {name}" + (f"  — {detail}" if detail else ""))

async def main():
    with open(GT_PATH, encoding="utf-8") as f:
        gt = json.load(f)

    params = StdioServerParameters(command="python3", args=["mimic_mcp_server.py"], env={**os.environ})
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = (await s.list_tools()).tools
            check("工具數量 = 4", len(tools) == 4, f"實得 {len(tools)}：{[t.name for t in tools]}")

            async def call(name, args):
                res = await s.call_tool(name, args)
                return json.loads(res.content[0].text)

            # 1) list_note_categories：總筆數與類別數、每類別筆數，全部對照 CSV
            cats = await call("list_note_categories", {})
            check("總筆數吻合 CSV", cats["total_notes"] == gt["total_rows"],
                  f"MCP={cats['total_notes']:,} / CSV={gt['total_rows']:,}")
            mcp_cat = {c["category"]: c["count"] for c in cats["categories"]}
            gt_cat = gt["category_counts_all"]
            check("類別數量吻合", len(mcp_cat) == gt["num_categories"],
                  f"MCP={len(mcp_cat)} / CSV={gt['num_categories']}")
            mismatches = {k: (mcp_cat.get(k), gt_cat.get(k)) for k in gt_cat if mcp_cat.get(k) != gt_cat.get(k)}
            check("每個類別筆數完全吻合", not mismatches,
                  "全部一致" if not mismatches else f"不符：{list(mismatches.items())[:5]}")

            # 2) count_notes：抽一個類別，用 exclude_errors=False 對照原始計數
            sample_cat = max(gt_cat, key=gt_cat.get)  # 取最大類別
            cn = await call("count_notes", {"category": sample_cat, "exclude_errors": False})
            check(f"count_notes('{sample_cat}', 含錯誤) 吻合",
                  cn["count"] == gt_cat[sample_cat], f"MCP={cn['count']:,} / CSV={gt_cat[sample_cat]:,}")
            # 同一類別排除錯誤
            cn2 = await call("count_notes", {"category": sample_cat, "exclude_errors": True})
            check(f"count_notes('{sample_cat}', 排除錯誤) 吻合",
                  cn2["count"] == gt["category_counts_noerror"].get(sample_cat),
                  f"MCP={cn2['count']:,} / CSV={gt['category_counts_noerror'].get(sample_cat):,}")

            # 3) get_note_text：用某類別樣本的 row_id，比對內文長度與開頭（含多行/引號處理）
            ex_cat = "Radiology" if "Radiology" in gt["examples_by_category"] else next(iter(gt["examples_by_category"]))
            ex = gt["examples_by_category"][ex_cat]
            note = await call("get_note_text", {"row_id": ex["row_id"], "max_chars": 100000})
            check(f"get_note_text(row {ex['row_id']}) 找到且類別正確",
                  note.get("found") and note.get("category") == ex_cat, f"類別={note.get('category')}")
            check("內文長度吻合 CSV（驗證引號/多行解析正確）",
                  len(note.get("text", "")) == ex["text_len"],
                  f"MCP={len(note.get('text',''))} / CSV={ex['text_len']}")
            check("內文開頭吻合 CSV",
                  note.get("text", "")[:60] == ex["text_head"])

            # 4) get_patient_overview：對照選定 subject 的總數、住院數、類別分佈
            ps = gt["pick_subject"]
            ov = await call("get_patient_overview", {"subject_id": ps["subject_id"]})
            check(f"get_patient_overview(subject {ps['subject_id']}) 總筆數吻合",
                  ov.get("total_notes") == ps["total_notes"],
                  f"MCP={ov.get('total_notes')} / CSV={ps['total_notes']}")
            check("住院次數(distinct HADM_ID) 吻合",
                  ov.get("admissions") == ps["admissions"],
                  f"MCP={ov.get('admissions')} / CSV={ps['admissions']}")
            ov_cat = {c["category"]: c["count"] for c in ov.get("by_category", [])}
            check("該病患類別分佈吻合", ov_cat == ps["by_category"],
                  "一致" if ov_cat == ps["by_category"] else f"MCP={ov_cat} / CSV={ps['by_category']}")

    print("\n" + ("=" * 48))
    print(f"結果：{sum(results)}/{len(results)} 項通過")
    sys.exit(0 if all(results) else 1)

if __name__ == "__main__":
    asyncio.run(main())
