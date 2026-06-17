#!/usr/bin/env python3
"""NoteSentry 的本機 MCP server（FastMCP / stdio）。

提供四個唯讀工具，讓本機 LLM 透過 MCP 查詢本機 SQLite 的 MIMIC-III 臨床紀錄：
    - list_note_categories : 各類別（CATEGORY）筆數
    - count_notes          : 依條件計數
    - get_patient_overview : 單一病患（SUBJECT_ID）的紀錄摘要
    - get_note_text        : 依 ROW_ID 取單筆內文

資料庫路徑透過環境變數 MIMIC_DB_PATH 指定（NoteSentry app 會自動帶入）。
本 server 不對外連線、僅讀取本機 SQLite，所有查詢均為參數化（避免注入）。

相依：pip install "mcp[cli]"
執行（stdio）：python3 mcp/servers/mimic_mcp_server.py
"""
from __future__ import annotations

import json
import os
import sqlite3
from typing import Annotated, Optional

from mcp.server.fastmcp import FastMCP
from pydantic import Field

DB_PATH = os.environ.get("MIMIC_DB_PATH", "mimic_notes.db")

mcp = FastMCP("mimic-notes")


def _connect() -> sqlite3.Connection:
    """以唯讀模式開啟資料庫；找不到檔案則回報清楚的錯誤。"""
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(
            f"找不到資料庫：{DB_PATH}。請先執行 mcp/scripts/build_db.py 建立，或在 NoteSentry 設定頁指定正確路徑。"
        )
    # 以 file: URI + mode=ro 確保唯讀，避免任何意外寫入。
    uri = f"file:{os.path.abspath(DB_PATH)}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


@mcp.tool()
def list_note_categories() -> str:
    """列出每個臨床紀錄類別（CATEGORY）的筆數，由多到少排序。

    適合回答「資料庫裡有哪些類別」「各類別各有多少筆」這類總覽問題。
    """
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT TRIM(CATEGORY) AS category, COUNT(*) AS n
            FROM notes
            GROUP BY TRIM(CATEGORY)
            ORDER BY n DESC
            """
        ).fetchall()
    data = [{"category": r["category"], "count": r["n"]} for r in rows]
    total = sum(d["count"] for d in data)
    return _dumps({"total_notes": total, "categories": data})


@mcp.tool()
def count_notes(
    category: Annotated[
        Optional[str],
        Field(description="紀錄類別，精確比對（不分大小寫與前後空白），例：Nursing、Radiology。省略則不限類別。"),
    ] = None,
    subject_id: Annotated[
        Optional[int], Field(description="病患識別碼 SUBJECT_ID。省略則不限病患。")
    ] = None,
    description: Annotated[
        Optional[str],
        Field(description="DESCRIPTION 欄位關鍵字，模糊比對（LIKE %關鍵字%）。省略則不限。"),
    ] = None,
    exclude_errors: Annotated[
        bool, Field(description="是否排除被標記為錯誤（ISERROR=1）的紀錄。預設 True。")
    ] = True,
) -> str:
    """依條件計算紀錄筆數。

    參數（皆可選，全省略則計算全部）：
        category:       類別，精確比對（不分大小寫前後空白），例：Nursing、Radiology
        subject_id:     病患 SUBJECT_ID
        description:    DESCRIPTION 關鍵字，模糊比對（LIKE %keyword%）
        exclude_errors: 是否排除被標記為錯誤（ISERROR=1）的紀錄，預設 True
    """
    clauses = []
    params: list = []
    if category is not None:
        clauses.append("LOWER(TRIM(CATEGORY)) = LOWER(TRIM(?))")
        params.append(category)
    if subject_id is not None:
        clauses.append("SUBJECT_ID = ?")
        params.append(subject_id)
    if description is not None:
        clauses.append("DESCRIPTION LIKE ?")
        params.append(f"%{description}%")
    if exclude_errors:
        clauses.append("(ISERROR IS NULL OR ISERROR = 0)")

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    with _connect() as conn:
        n = conn.execute(f"SELECT COUNT(*) FROM notes{where}", params).fetchone()[0]

    return _dumps(
        {
            "count": n,
            "filters": {
                "category": category,
                "subject_id": subject_id,
                "description": description,
                "exclude_errors": exclude_errors,
            },
        }
    )


@mcp.tool()
def get_patient_overview(
    subject_id: Annotated[int, Field(description="病患識別碼 SUBJECT_ID（必填）。")],
) -> str:
    """取得單一病患（SUBJECT_ID）的紀錄摘要。

    內容包含：總筆數、各類別筆數、住院次數（不重複 HADM_ID）、
    紀錄日期範圍，以及最近數筆紀錄的索引（ROW_ID / 類別 / 日期），
    方便接著用 get_note_text 取完整內文。
    """
    with _connect() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM notes WHERE SUBJECT_ID = ?", (subject_id,)
        ).fetchone()[0]

        if total == 0:
            return _dumps({"subject_id": subject_id, "found": False, "message": "查無此病患的紀錄。"})

        by_cat = conn.execute(
            """
            SELECT TRIM(CATEGORY) AS category, COUNT(*) AS n
            FROM notes WHERE SUBJECT_ID = ?
            GROUP BY TRIM(CATEGORY) ORDER BY n DESC
            """,
            (subject_id,),
        ).fetchall()

        admissions = conn.execute(
            "SELECT COUNT(DISTINCT HADM_ID) FROM notes WHERE SUBJECT_ID = ? AND HADM_ID IS NOT NULL",
            (subject_id,),
        ).fetchone()[0]

        date_range = conn.execute(
            "SELECT MIN(CHARTDATE) AS first, MAX(CHARTDATE) AS last FROM notes WHERE SUBJECT_ID = ?",
            (subject_id,),
        ).fetchone()

        recent = conn.execute(
            """
            SELECT ROW_ID, TRIM(CATEGORY) AS category, DESCRIPTION, CHARTDATE
            FROM notes WHERE SUBJECT_ID = ?
            ORDER BY CHARTDATE DESC, ROW_ID DESC
            LIMIT 10
            """,
            (subject_id,),
        ).fetchall()

    return _dumps(
        {
            "subject_id": subject_id,
            "found": True,
            "total_notes": total,
            "admissions": admissions,
            "date_range": {"first": date_range["first"], "last": date_range["last"]},
            "by_category": [{"category": r["category"], "count": r["n"]} for r in by_cat],
            "recent_notes": [
                {
                    "row_id": r["ROW_ID"],
                    "category": r["category"],
                    "description": r["DESCRIPTION"],
                    "chartdate": r["CHARTDATE"],
                }
                for r in recent
            ],
        }
    )


def _fts_available(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name = 'notes_fts'"
    ).fetchone()
    return row is not None


def _to_match_expr(query: str) -> str:
    """把使用者關鍵字轉成安全的 FTS5 MATCH 運算式。

    將每個詞以雙引號包起並以 AND 串接（所有詞都需出現），可避免特殊字元
    造成的語法錯誤。例：'chest pain' -> '"chest" AND "pain"'。
    """
    terms = [t for t in query.replace('"', " ").split() if t]
    return " AND ".join(f'"{t}"' for t in terms)


@mcp.tool()
def search_notes(
    query: Annotated[
        str, Field(description="全文檢索關鍵字，多個詞以空白分隔（皆需出現），例：pneumonia chest pain。")
    ],
    category: Annotated[
        Optional[str], Field(description="限定紀錄類別（可選），例：Radiology、Nursing。省略則不限。")
    ] = None,
    limit: Annotated[
        int, Field(description="回傳筆數上限（預設 10、上限 50；超過會被截到 50）。")
    ] = 10,
    exclude_errors: Annotated[
        bool, Field(description="是否排除被標記為錯誤（ISERROR=1）的紀錄。預設 True。")
    ] = True,
) -> str:
    """全文檢索：在所有臨床紀錄的內文（TEXT）中搜尋關鍵字，回傳最相關的數筆。

    每筆結果含 row_id、病患、類別、日期與命中片段（snippet），可接著用
    get_note_text 取完整內文。

    參數：
        query:          關鍵字，多個詞以空白分隔（皆需出現），例：pneumonia、chest pain
        category:       限定類別（可選），例：Radiology、Nursing
        limit:          回傳筆數上限（預設 10，最多 50）
        exclude_errors: 是否排除被標記為錯誤（ISERROR=1）的紀錄，預設 True
    """
    match_expr = _to_match_expr(query)
    if not match_expr:
        return _dumps({"query": query, "error": "請提供至少一個關鍵字。"})
    limit = max(1, min(int(limit), 50))

    with _connect() as conn:
        if not _fts_available(conn):
            return _dumps(
                {
                    "query": query,
                    "error": "尚未建立全文檢索索引。請執行：python3 mcp/scripts/build_db.py --fts-only",
                }
            )

        clauses = ["notes_fts MATCH ?"]
        params: list = [match_expr]
        if category is not None:
            clauses.append("LOWER(TRIM(n.CATEGORY)) = LOWER(TRIM(?))")
            params.append(category)
        if exclude_errors:
            clauses.append("(n.ISERROR IS NULL OR n.ISERROR = 0)")
        params.append(limit)

        rows = conn.execute(
            f"""
            SELECT n.ROW_ID, n.SUBJECT_ID, TRIM(n.CATEGORY) AS category,
                   n.CHARTDATE,
                   snippet(notes_fts, 0, '《', '》', ' … ', 12) AS snip
            FROM notes_fts
            JOIN notes n ON n.ROW_ID = notes_fts.rowid
            WHERE {' AND '.join(clauses)}
            ORDER BY bm25(notes_fts)
            LIMIT ?
            """,
            params,
        ).fetchall()

    return _dumps(
        {
            "query": query,
            "match_expr": match_expr,
            "returned": len(rows),
            "results": [
                {
                    "row_id": r["ROW_ID"],
                    "subject_id": r["SUBJECT_ID"],
                    "category": r["category"],
                    "chartdate": r["CHARTDATE"],
                    "snippet": r["snip"],
                }
                for r in rows
            ],
        }
    )


@mcp.tool()
def get_note_text(
    row_id: Annotated[int, Field(description="紀錄列識別碼 ROW_ID（由 search_notes／get_patient_overview 取得）。")],
    max_chars: Annotated[
        int, Field(description="回傳內文的最大字元數（預設 8000；過長會截斷）。")
    ] = 8000,
) -> str:
    """依 ROW_ID 取得單筆紀錄的完整內文與中繼資料。

    參數：
        row_id:    紀錄的 ROW_ID（可由 get_patient_overview 取得）
        max_chars: 內文最大字元數，超過則截斷（預設 8000），避免一次塞爆上下文
    """
    with _connect() as conn:
        r = conn.execute(
            """
            SELECT ROW_ID, SUBJECT_ID, HADM_ID, CHARTDATE, CHARTTIME,
                   TRIM(CATEGORY) AS category, DESCRIPTION, ISERROR, TEXT
            FROM notes WHERE ROW_ID = ?
            """,
            (row_id,),
        ).fetchone()

    if r is None:
        return _dumps({"row_id": row_id, "found": False, "message": "查無此 ROW_ID。"})

    text = r["TEXT"] or ""
    truncated = len(text) > max_chars
    if truncated:
        text = text[:max_chars]

    return _dumps(
        {
            "row_id": r["ROW_ID"],
            "found": True,
            "subject_id": r["SUBJECT_ID"],
            "hadm_id": r["HADM_ID"],
            "category": r["category"],
            "description": r["DESCRIPTION"],
            "chartdate": r["CHARTDATE"],
            "charttime": r["CHARTTIME"],
            "is_error": bool(r["ISERROR"]) if r["ISERROR"] is not None else False,
            "truncated": truncated,
            "text": text,
        }
    )


if __name__ == "__main__":
    # 預設以 stdio 傳輸執行，供 NoteSentry app 以子行程方式叫起。
    mcp.run()
