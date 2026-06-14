#!/usr/bin/env python3
"""把 MIMIC-III 的 NOTEEVENTS.csv 串流匯入本機 SQLite（mimic_notes.db）。

只用 Python 標準函式庫（csv + sqlite3），可處理數 GB 的大檔，不需 pandas。
資料全程留在本機，不對外連線。

用法：
    python3 build_db.py
    python3 build_db.py --csv MIMIC-III/dataset/NOTEEVENTS.csv --db mimic_notes.db
    python3 build_db.py --limit 50000        # 只匯入前 N 列（測試用）
    python3 build_db.py --rebuild            # 砍掉重建（預設若已存在則中止）
"""
from __future__ import annotations

import argparse
import csv
import os
import sqlite3
import sys
import time

# TEXT 欄位可能非常長，放寬 csv 單欄上限。
csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

DEFAULT_CSV = os.path.join("MIMIC-III", "dataset", "NOTEEVENTS.csv")
DEFAULT_DB = "mimic_notes.db"

# CSV 欄位順序（與 NOTEEVENTS.csv 表頭一致）
COLUMNS = [
    "ROW_ID",
    "SUBJECT_ID",
    "HADM_ID",
    "CHARTDATE",
    "CHARTTIME",
    "STORETIME",
    "CATEGORY",
    "DESCRIPTION",
    "CGID",
    "ISERROR",
    "TEXT",
]
INT_COLUMNS = {"ROW_ID", "SUBJECT_ID", "HADM_ID", "CGID", "ISERROR"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS notes (
    ROW_ID      INTEGER PRIMARY KEY,
    SUBJECT_ID  INTEGER,
    HADM_ID     INTEGER,
    CHARTDATE   TEXT,
    CHARTTIME   TEXT,
    STORETIME   TEXT,
    CATEGORY    TEXT,
    DESCRIPTION TEXT,
    CGID        INTEGER,
    ISERROR     INTEGER,
    TEXT        TEXT
);
"""

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_notes_subject  ON notes(SUBJECT_ID);",
    "CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(CATEGORY);",
    "CREATE INDEX IF NOT EXISTS idx_notes_hadm     ON notes(HADM_ID);",
]


def to_int(value: str):
    """空字串/空白 → None；否則轉 int（去掉可能的小數點，如 '167853.0'）。"""
    if value is None:
        return None
    v = value.strip()
    if v == "":
        return None
    try:
        return int(v)
    except ValueError:
        try:
            return int(float(v))
        except ValueError:
            return None


def coerce_row(raw: dict) -> tuple:
    out = []
    for col in COLUMNS:
        val = raw.get(col)
        if col in INT_COLUMNS:
            out.append(to_int(val))
        else:
            out.append(val if (val is not None and val != "") else None)
    return tuple(out)


def build(csv_path: str, db_path: str, limit: int | None, rebuild: bool) -> None:
    if not os.path.exists(csv_path):
        sys.exit(f"找不到 CSV：{csv_path}")

    if os.path.exists(db_path):
        if rebuild:
            os.remove(db_path)
            print(f"[build] 已移除既有資料庫 {db_path}")
        else:
            sys.exit(f"資料庫已存在：{db_path}（要重建請加 --rebuild）")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    # 匯入期間關閉同步與 journal 以加速；建好後再回復。
    cur.execute("PRAGMA journal_mode = OFF;")
    cur.execute("PRAGMA synchronous = OFF;")
    cur.execute("PRAGMA temp_store = MEMORY;")
    cur.executescript(SCHEMA)

    placeholders = ",".join(["?"] * len(COLUMNS))
    insert_sql = f"INSERT OR REPLACE INTO notes ({','.join(COLUMNS)}) VALUES ({placeholders})"

    batch: list[tuple] = []
    BATCH_SIZE = 5000
    inserted = 0
    start = time.time()

    with open(csv_path, "r", newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        missing = [c for c in COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            conn.close()
            sys.exit(f"CSV 缺少欄位：{missing}；實際表頭：{reader.fieldnames}")

        for row in reader:
            batch.append(coerce_row(row))
            if len(batch) >= BATCH_SIZE:
                cur.executemany(insert_sql, batch)
                inserted += len(batch)
                batch.clear()
                if inserted % 100000 == 0:
                    rate = inserted / max(time.time() - start, 1e-6)
                    print(f"[build] 已匯入 {inserted:,} 列（{rate:,.0f} 列/秒）")
            if limit is not None and inserted + len(batch) >= limit:
                break

    if batch:
        cur.executemany(insert_sql, batch)
        inserted += len(batch)

    conn.commit()

    print("[build] 建立索引中…")
    for stmt in INDEXES:
        cur.execute(stmt)
    conn.commit()

    cur.execute("PRAGMA synchronous = NORMAL;")
    cur.execute("PRAGMA journal_mode = WAL;")
    conn.commit()

    total = cur.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
    conn.close()
    elapsed = time.time() - start
    print(f"[build] 完成：{total:,} 列，耗時 {elapsed:,.1f} 秒 → {db_path}")


def build_fts(db_path: str) -> None:
    """為既有資料庫建立 FTS5 全文檢索索引（external content，不複製 TEXT 內容）。

    使用 porter + unicode61 斷詞，讓英文臨床字詞的單複數/詞形變化也能命中
    （如 pneumonia / pneumonias）。此步驟會掃過全部 TEXT，約需數分鐘。
    """
    if not os.path.exists(db_path):
        sys.exit(f"找不到資料庫：{db_path}（請先執行 build_db.py 匯入資料）")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode = OFF;")
    cur.execute("PRAGMA synchronous = OFF;")
    cur.execute("PRAGMA temp_store = MEMORY;")

    start = time.time()
    print("[fts] 建立全文檢索索引中（external content）…")
    cur.execute("DROP TABLE IF EXISTS notes_fts;")
    cur.execute(
        """
        CREATE VIRTUAL TABLE notes_fts USING fts5(
            TEXT,
            content='notes',
            content_rowid='ROW_ID',
            tokenize='porter unicode61'
        );
        """
    )
    cur.execute("INSERT INTO notes_fts(rowid, TEXT) SELECT ROW_ID, TEXT FROM notes;")
    conn.commit()

    cur.execute("PRAGMA synchronous = NORMAL;")
    cur.execute("PRAGMA journal_mode = WAL;")
    conn.commit()
    n = cur.execute("SELECT COUNT(*) FROM notes_fts").fetchone()[0]
    conn.close()
    print(f"[fts] 完成：已索引 {n:,} 筆，耗時 {time.time() - start:,.1f} 秒")


def main() -> None:
    p = argparse.ArgumentParser(description="匯入 NOTEEVENTS.csv 到 SQLite")
    p.add_argument("--csv", default=DEFAULT_CSV, help="NOTEEVENTS.csv 路徑")
    p.add_argument("--db", default=DEFAULT_DB, help="輸出 SQLite 路徑")
    p.add_argument("--limit", type=int, default=None, help="只匯入前 N 列（測試用）")
    p.add_argument("--rebuild", action="store_true", help="若已存在則先刪除重建")
    p.add_argument("--with-fts", action="store_true", help="匯入後一併建立全文檢索索引")
    p.add_argument(
        "--fts-only",
        action="store_true",
        help="只對既有資料庫補建全文檢索索引（不重新匯入 CSV）",
    )
    args = p.parse_args()

    if args.fts_only:
        build_fts(args.db)
        return

    build(args.csv, args.db, args.limit, args.rebuild)
    if args.with_fts:
        build_fts(args.db)


if __name__ == "__main__":
    main()
