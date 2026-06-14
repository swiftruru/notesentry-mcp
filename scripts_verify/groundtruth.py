#!/usr/bin/env python3
"""直接掃描原始 NOTEEVENTS.csv，算出「標準答案」，與 MCP 輸出比對用。

完全獨立於 build_db.py / SQLite，純讀 CSV，作為對照基準。
輸出 scripts_verify/ground_truth.json。
"""
import csv, json, os, sys, time

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

CSV_PATH = os.path.join("MIMIC-III", "dataset", "NOTEEVENTS.csv")
OUT = os.path.join("scripts_verify", "ground_truth.json")

def to_int(v):
    v = (v or "").strip()
    if v == "":
        return None
    try:
        return int(v)
    except ValueError:
        try:
            return int(float(v))
        except ValueError:
            return None

def main():
    total = 0
    iserror_count = 0
    cat_counts = {}            # 全部列（含 ISERROR）— 對應 list_note_categories
    cat_counts_noerr = {}      # 排除 ISERROR=1 — 對應 count_notes(exclude_errors=True)
    examples = {}              # 每個類別第一次出現的樣本，供 get_note_text / overview 比對
    subj_cat = {}              # 針對選定 subject 的類別分佈
    pick_subject = None        # 之後挑一個樣本 subject 來驗 overview

    start = time.time()
    with open(CSV_PATH, "r", newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            cat = (row.get("CATEGORY") or "").strip()
            iserr = to_int(row.get("ISERROR"))
            is_err = (iserr == 1)
            if is_err:
                iserror_count += 1
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
            if not is_err:
                cat_counts_noerr[cat] = cat_counts_noerr.get(cat, 0) + 1

            if cat not in examples:
                text = row.get("TEXT") or ""
                examples[cat] = {
                    "row_id": to_int(row.get("ROW_ID")),
                    "subject_id": to_int(row.get("SUBJECT_ID")),
                    "hadm_id": to_int(row.get("HADM_ID")),
                    "chartdate": (row.get("CHARTDATE") or None),
                    "text_len": len(text),
                    "text_head": text[:60],
                }

            if total % 500000 == 0:
                print(f"[gt] 已掃 {total:,} 列（{total/max(time.time()-start,1e-6):,.0f}/s）", flush=True)

    # 挑一個「紀錄筆數適中」的 subject 來驗 overview：用最後一個 example 的 subject
    # 為了穩定，挑 Radiology 類別樣本的 subject（通常一位病患有多筆），否則退而求其次。
    cand_cat = "Radiology" if "Radiology" in examples else next(iter(examples))
    pick_subject = examples[cand_cat]["subject_id"]

    # 第二輪只為這個 subject 算類別分佈（小量、快速；避免一次存太多狀態）
    with open(CSV_PATH, "r", newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        n_total = 0
        hadms = set()
        for row in reader:
            if to_int(row.get("SUBJECT_ID")) == pick_subject:
                n_total += 1
                c = (row.get("CATEGORY") or "").strip()
                subj_cat[c] = subj_cat.get(c, 0) + 1
                h = to_int(row.get("HADM_ID"))
                if h is not None:
                    hadms.add(h)

    result = {
        "csv_path": CSV_PATH,
        "total_rows": total,
        "iserror_count": iserror_count,
        "num_categories": len(cat_counts),
        "category_counts_all": cat_counts,
        "category_counts_noerror": cat_counts_noerr,
        "examples_by_category": examples,
        "pick_subject": {
            "subject_id": pick_subject,
            "total_notes": n_total,
            "admissions": len(hadms),
            "by_category": subj_cat,
        },
    }
    os.makedirs("scripts_verify", exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"[gt] 完成：{total:,} 列、{len(cat_counts)} 類別、耗時 {time.time()-start:,.1f}s → {OUT}", flush=True)

if __name__ == "__main__":
    main()
