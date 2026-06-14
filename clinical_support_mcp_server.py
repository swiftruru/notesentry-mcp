#!/usr/bin/env python3
"""NoteSentry 臨床輔助 MCP server（FastMCP / stdio）。

對應簡報的「應用 A：LLM 輔助檢傷」與「應用 B：LLM 輔助病歷生成」。

設計原則(三層防線):這些工具不做臨床判斷,而是把 LLM 的推理「接地」到
確定性的依據——檢傷分級與 SOAP 擴寫仍由 LLM 推理、再由醫護人類覆核:
    - assess_vital_signs : 純規則判讀生命徵象、標出危急紅旗(零幻覺、可重現)
    - get_ttas_reference : 回傳 TTAS 五級檢傷的官方判定原則(內建知識,供 LLM 依循)
    - get_soap_template  : 回傳 SOAP 病歷結構與各段內容指引(確保格式一致)

此 server 不需資料庫、不對外連線、無任何副作用(純查表/純計算)。
相依：pip install "mcp[cli]"
執行（stdio）：python3 clinical_support_mcp_server.py
"""
from __future__ import annotations

import json
from typing import Optional

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("clinical-support")


def _dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


# --- 應用 A：檢傷 ------------------------------------------------------------

# 成人生命徵象的紅旗門檻(參考一般急診/TTAS 常用界值;最終以院內標準與臨床判斷為準)
def _flag(parameter, value, unit, severity, note):
    return {"parameter": parameter, "value": value, "unit": unit,
            "severity": severity, "note": note}


@mcp.tool()
def assess_vital_signs(
    temperature_c: Optional[float] = None,
    heart_rate: Optional[int] = None,
    resp_rate: Optional[int] = None,
    spo2: Optional[int] = None,
    sbp: Optional[int] = None,
    dbp: Optional[int] = None,
    gcs: Optional[int] = None,
    age_years: Optional[int] = None,
) -> str:
    """純規則判讀成人生命徵象,標出異常與危急紅旗(deterministic,無 LLM、可重現)。

    作為檢傷的「安全網」:LLM 仍負責建議級別,但本工具確保危急數值不會被漏看。
    所有參數皆可選,只判讀有提供的項目。severity 分 critical(危急)/warning(警示)/normal。

    參數:
        temperature_c: 體溫(攝氏)   heart_rate: 心跳(/分)   resp_rate: 呼吸(/分)
        spo2: 血氧飽和(%)            sbp/dbp: 收縮/舒張壓(mmHg)
        gcs: 昏迷指數(3-15)          age_years: 年齡(目前依成人界值判讀)
    """
    findings = []

    if spo2 is not None:
        if spo2 < 90:
            findings.append(_flag("SpO2", spo2, "%", "critical", "嚴重低血氧(<90%),疑呼吸衰竭"))
        elif spo2 < 94:
            findings.append(_flag("SpO2", spo2, "%", "warning", "低血氧(90–93%)"))
        else:
            findings.append(_flag("SpO2", spo2, "%", "normal", "血氧正常"))

    if heart_rate is not None:
        if heart_rate > 150 or heart_rate < 40:
            findings.append(_flag("HR", heart_rate, "bpm", "critical", "極端心率,血行動力學不穩風險"))
        elif heart_rate > 120 or heart_rate < 50:
            findings.append(_flag("HR", heart_rate, "bpm", "warning", "心搏過速/過緩"))
        else:
            findings.append(_flag("HR", heart_rate, "bpm", "normal", "心率正常"))

    if resp_rate is not None:
        if resp_rate > 30 or resp_rate < 8:
            findings.append(_flag("RR", resp_rate, "/min", "critical", "呼吸極快/極慢,呼吸窘迫"))
        elif resp_rate > 20:
            findings.append(_flag("RR", resp_rate, "/min", "warning", "呼吸過速"))
        else:
            findings.append(_flag("RR", resp_rate, "/min", "normal", "呼吸正常"))

    if sbp is not None:
        if sbp < 90:
            findings.append(_flag("SBP", sbp, "mmHg", "critical", "低血壓,疑休克"))
        elif sbp > 220:
            findings.append(_flag("SBP", sbp, "mmHg", "critical", "極度高血壓,疑高血壓危象"))
        elif sbp > 180:
            findings.append(_flag("SBP", sbp, "mmHg", "warning", "血壓偏高"))
        else:
            findings.append(_flag("SBP", sbp, "mmHg", "normal", "收縮壓正常範圍"))

    if dbp is not None and dbp > 120:
        findings.append(_flag("DBP", dbp, "mmHg", "warning", "舒張壓偏高"))

    if temperature_c is not None:
        if temperature_c >= 40 or temperature_c < 35:
            findings.append(_flag("Temp", temperature_c, "°C", "critical",
                                  "超高燒或低體溫" if temperature_c >= 40 else "低體溫"))
        elif temperature_c >= 38.5:
            findings.append(_flag("Temp", temperature_c, "°C", "warning", "發燒"))
        else:
            findings.append(_flag("Temp", temperature_c, "°C", "normal", "體溫正常範圍"))

    if gcs is not None:
        if gcs < 9:
            findings.append(_flag("GCS", gcs, "", "critical", "意識嚴重改變(GCS<9),考慮呼吸道保護"))
        elif gcs < 14:
            findings.append(_flag("GCS", gcs, "", "warning", "意識改變"))
        else:
            findings.append(_flag("GCS", gcs, "", "normal", "意識清楚"))

    order = {"critical": 2, "warning": 1, "normal": 0}
    overall = "normal"
    for f in findings:
        if order[f["severity"]] > order[overall]:
            overall = f["severity"]

    n_crit = sum(1 for f in findings if f["severity"] == "critical")
    n_warn = sum(1 for f in findings if f["severity"] == "warning")

    if overall == "critical":
        hint = "出現危急生命徵象,通常對應 TTAS 第 1–2 級,請立即評估。"
    elif overall == "warning":
        hint = "出現異常生命徵象,通常需提高警覺(常見 TTAS 第 2–3 級)。"
    else:
        hint = "生命徵象未見明顯異常,仍須綜合主訴判斷。"

    return _dumps({
        "evaluated": [k for k, v in {
            "temperature_c": temperature_c, "heart_rate": heart_rate, "resp_rate": resp_rate,
            "spo2": spo2, "sbp": sbp, "dbp": dbp, "gcs": gcs}.items() if v is not None],
        "overall_severity": overall,
        "critical_count": n_crit,
        "warning_count": n_warn,
        "findings": findings,
        "triage_hint": hint,
        "disclaimer": "此為規則式生命徵象判讀,非診斷;最終檢傷級別由檢傷護理師判定。",
    })


# TTAS 五級檢傷參考(Taiwan Triage and Acuity Scale)
_TTAS_LEVELS = [
    {"level": 1, "name_zh": "復甦", "name_en": "Resuscitation", "target_time": "立即",
     "description": "生命徵象不穩、有立即生命威脅,需立即急救。",
     "examples": ["心跳/呼吸停止", "重度呼吸窘迫", "休克", "GCS<9", "持續癲癇"]},
    {"level": 2, "name_zh": "危急", "name_en": "Emergent", "target_time": "10 分鐘內",
     "description": "潛在生命或肢體威脅,病情可能快速惡化。",
     "examples": ["疑似 ACS 的胸痛", "中重度呼吸困難", "意識改變", "腦中風徵象", "嚴重外傷"]},
    {"level": 3, "name_zh": "緊急", "name_en": "Urgent", "target_time": "30 分鐘內",
     "description": "需及時處置但短期內無立即生命威脅。",
     "examples": ["中度氣喘", "持續嘔吐脫水", "中度腹痛", "發燒合併系統症狀"]},
    {"level": 4, "name_zh": "次緊急", "name_en": "Less urgent", "target_time": "60 分鐘內",
     "description": "症狀輕中度,可等待。",
     "examples": ["輕度外傷", "輕度腹瀉", "慢性問題輕度惡化"]},
    {"level": 5, "name_zh": "非緊急", "name_en": "Non-urgent", "target_time": "120 分鐘內",
     "description": "非急性、輕微問題或行政需求。",
     "examples": ["換藥", "拆線", "慢性穩定症狀", "診斷書"]},
]

# 常見主訴 → 需留意的紅旗組合與建議級別(供 LLM 參考,非取代判斷)
_COMPLAINT_FLAGS = {
    "胸痛": {"suggested_level": 2, "red_flags": ["冒冷汗", "放射至左臂/下顎", "呼吸困難", "低血壓"],
            "note": "胸痛合併冒冷汗/呼吸困難 → 疑急性冠心症(ACS),建議至少 Level 2。"},
    "呼吸困難": {"suggested_level": 2, "red_flags": ["SpO2<94", "發紺", "講話斷句", "使用輔助呼吸肌"],
              "note": "中重度呼吸窘迫優先處置。"},
    "意識改變": {"suggested_level": 2, "red_flags": ["GCS 下降", "新發神經學缺損", "低血糖"],
              "note": "意識改變需排除中風/低血糖/缺氧。"},
    "腹痛": {"suggested_level": 3, "red_flags": ["低血壓", "持續嘔吐", "板硬腹", "孕婦"],
            "note": "合併血行動力學不穩或腹膜炎徵象需升級。"},
    "發燒": {"suggested_level": 3, "red_flags": ["低血壓", "意識改變", "免疫低下", "頸僵直"],
            "note": "發燒合併敗血症徵象(qSOFA)需升級至 Level 2。"},
    "外傷": {"suggested_level": 3, "red_flags": ["高能量機轉", "活動性出血", "意識改變", "低血壓"],
            "note": "依機轉與生命徵象決定,重大外傷為 Level 1–2。"},
}


@mcp.tool()
def get_ttas_reference(chief_complaint: Optional[str] = None) -> str:
    """回傳 TTAS 五級檢傷的判定原則(內建參考知識)。供 LLM 建議級別時依循,而非空想。

    參數:
        chief_complaint: 主訴關鍵字(可選),例:胸痛、呼吸困難、發燒。提供時會額外回傳
                         該主訴需留意的紅旗組合與建議級別。
    """
    result = {"scale": "TTAS（Taiwan Triage and Acuity Scale,5 級）", "levels": _TTAS_LEVELS}
    if chief_complaint:
        matched = {k: v for k, v in _COMPLAINT_FLAGS.items() if k in chief_complaint or chief_complaint in k}
        result["chief_complaint"] = chief_complaint
        result["relevant_flags"] = matched or "（無內建對應;請依五級原則與生命徵象綜合判斷）"
    result["disclaimer"] = "此為檢傷參考標準,最終級別由檢傷護理師依院內規範與臨床判斷決定。"
    return _dumps(result)


# --- 應用 B：SOAP 病歷 ------------------------------------------------------

@mcp.tool()
def get_soap_template(note_type: str = "急診醫師病歷") -> str:
    """回傳 SOAP 病歷的結構與各段內容指引,確保 LLM 擴寫的病歷格式一致、欄位齊全。

    LLM 負責把醫師輸入的關鍵字擴寫成各段內容;本工具只提供骨架與檢核要點。
    真實病史/檢查數據應另以資料工具(如 MIMIC 查詢、search_notes)接地,不可臆造。

    參數:
        note_type: 病歷類型(可選),例:急診醫師病歷、護理紀錄、出院摘要。
    """
    sections = [
        {"key": "S", "name": "Subjective 主觀", "include": "主訴、現病史(OPQRST)、相關過去病史、過敏史、用藥史",
         "prompts": ["主訴與發作時間", "症狀性質/部位/誘發緩解因子", "相關陰性表現"]},
        {"key": "O", "name": "Objective 客觀", "include": "生命徵象、理學檢查、檢驗/影像結果",
         "prompts": ["生命徵象(可由 assess_vital_signs 接地)", "重點理學發現", "已知檢查結果"]},
        {"key": "A", "name": "Assessment 評估", "include": "問題列表、鑑別診斷、嚴重度/檢傷級別",
         "prompts": ["主要診斷與鑑別", "臨床推理依據", "風險分層"]},
        {"key": "P", "name": "Plan 計畫", "include": "處置、檢查、用藥、會診、處置去向(離院/收治)、衛教",
         "prompts": ["立即處置與醫囑", "後續檢查/會診", "去向與追蹤計畫"]},
    ]
    return _dumps({
        "note_type": note_type,
        "format": "SOAP",
        "sections": sections,
        "rules": [
            "僅就醫師提供的關鍵字擴寫,不得臆造未提供的病史或數據。",
            "不確定或缺漏處標記為「待補」,交醫師補齊。",
            "輸出為草稿,須由醫師 review、修改並簽核後方可採用。",
        ],
        "disclaimer": "此為病歷草稿模板;最終內容由負責醫師確認並簽核。",
    })


if __name__ == "__main__":
    mcp.run()
