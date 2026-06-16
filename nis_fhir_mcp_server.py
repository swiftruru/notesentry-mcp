#!/usr/bin/env python3
"""NoteSentry NIS / FHIR MCP server（FastMCP / stdio）。

對應簡報「NIS-MCP：護理紀錄、生命徵象」這一支柱，並具體展示**任務三的 FHIR 標準對接**。

設計原則：把生命徵象輸出成 **HL7 FHIR R4 的 Observation 資源**（含 LOINC 代碼、UCUM
單位、vital-signs 分類），示範院內系統如何以標準格式交換資料——這正是跨系統整合
（HIS/NIS/LIS/藥事）能互通的關鍵。本 server 為知識/格式轉換式，不需資料庫、無副作用。

相依：pip install "mcp[cli]"
執行（stdio）：python3 nis_fhir_mcp_server.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("nis-fhir")

UCUM = "http://unitsofmeasure.org"
LOINC = "http://loinc.org"
VITAL_CAT = "http://terminology.hl7.org/CodeSystem/observation-category"


def _dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _vital_category() -> list:
    return [{
        "coding": [{"system": VITAL_CAT, "code": "vital-signs", "display": "Vital Signs"}]
    }]


def _observation(loinc: str, display: str, value: float, unit: str, ucum: str,
                 eff: str, subject_id: Optional[int]) -> dict:
    obs = {
        "resourceType": "Observation",
        "status": "final",
        "category": _vital_category(),
        "code": {"coding": [{"system": LOINC, "code": loinc, "display": display}],
                 "text": display},
        "effectiveDateTime": eff,
        "valueQuantity": {"value": value, "unit": unit, "system": UCUM, "code": ucum},
    }
    if subject_id is not None:
        obs["subject"] = {"reference": f"Patient/{subject_id}"}
    return obs


@mcp.tool()
def vitals_to_fhir(
    temperature_c: Optional[float] = None,
    heart_rate: Optional[int] = None,
    resp_rate: Optional[int] = None,
    spo2: Optional[int] = None,
    sbp: Optional[int] = None,
    dbp: Optional[int] = None,
    subject_id: Optional[int] = None,
) -> str:
    """把生命徵象轉成 HL7 FHIR R4 的 Observation（含 LOINC 代碼），以標準格式回傳一個 Bundle。

    示範 NIS 生命徵象資料如何以 FHIR 交換（任務三的跨系統整合與標準對接）。
    所有參數可選，只轉換有提供的項目。血壓回傳為含 systolic/diastolic component 的單一 Observation。

    參數：
        temperature_c 體溫(°C)、heart_rate 心跳(/min)、resp_rate 呼吸(/min)、
        spo2 血氧(%)、sbp/dbp 收縮/舒張壓(mmHg)、subject_id 病患（可選，產生 Patient 參照）
    """
    eff = _now_iso()
    entries = []

    if heart_rate is not None:
        entries.append(_observation("8867-4", "Heart rate", heart_rate, "beats/minute", "/min", eff, subject_id))
    if resp_rate is not None:
        entries.append(_observation("9279-1", "Respiratory rate", resp_rate, "breaths/minute", "/min", eff, subject_id))
    if temperature_c is not None:
        entries.append(_observation("8310-5", "Body temperature", temperature_c, "Cel", "Cel", eff, subject_id))
    if spo2 is not None:
        entries.append(_observation("59408-5", "Oxygen saturation in Arterial blood by Pulse oximetry", spo2, "%", "%", eff, subject_id))
    if sbp is not None or dbp is not None:
        bp = {
            "resourceType": "Observation",
            "status": "final",
            "category": _vital_category(),
            "code": {"coding": [{"system": LOINC, "code": "85354-9", "display": "Blood pressure panel"}],
                     "text": "Blood pressure"},
            "effectiveDateTime": eff,
            "component": [],
        }
        if subject_id is not None:
            bp["subject"] = {"reference": f"Patient/{subject_id}"}
        if sbp is not None:
            bp["component"].append({
                "code": {"coding": [{"system": LOINC, "code": "8480-6", "display": "Systolic blood pressure"}]},
                "valueQuantity": {"value": sbp, "unit": "mmHg", "system": UCUM, "code": "mm[Hg]"},
            })
        if dbp is not None:
            bp["component"].append({
                "code": {"coding": [{"system": LOINC, "code": "8462-4", "display": "Diastolic blood pressure"}]},
                "valueQuantity": {"value": dbp, "unit": "mmHg", "system": UCUM, "code": "mm[Hg]"},
            })
        entries.append(bp)

    bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "timestamp": eff,
        "total": len(entries),
        "entry": [{"resource": r} for r in entries],
    }
    return _dumps({
        "format": "HL7 FHIR R4",
        "bundle": bundle,
        "note": "以 LOINC 代碼與 UCUM 單位輸出，符合 FHIR vital-signs profile，可供 HIS/NIS/LIS 互通。",
    })


# --- 四支柱對應的 FHIR 資源對照（知識，供說明任務三的標準對接）---
_FHIR_RESOURCES = {
    "Patient": {
        "pillar": "HIS",
        "purpose": "病患基本資料（去識別化後僅保留必要欄位）",
        "key_fields": ["id", "identifier", "gender", "birthDate(去識別為年齡區間)"],
    },
    "Observation": {
        "pillar": "NIS / LIS",
        "purpose": "生命徵象、檢驗結果（本 server 的 vitals_to_fhir 即產生此資源）",
        "key_fields": ["status", "category(vital-signs)", "code(LOINC)", "valueQuantity(UCUM)", "effectiveDateTime", "subject"],
    },
    "AllergyIntolerance": {
        "pillar": "藥事 / HIS",
        "purpose": "過敏史（供藥事-MCP 比對過敏衝突）",
        "key_fields": ["clinicalStatus", "code", "patient", "reaction.manifestation", "criticality"],
    },
    "MedicationStatement": {
        "pillar": "藥事",
        "purpose": "用藥史（供藥事-MCP 做交互作用檢查）",
        "key_fields": ["status", "medicationCodeableConcept", "subject", "effectivePeriod", "dosage"],
    },
}


@mcp.tool()
def get_fhir_reference(resource_type: str = "Observation") -> str:
    """回傳某個 FHIR 資源的用途與關鍵欄位，並對應到四支柱（HIS/NIS/LIS/藥事）。

    用來說明任務三「如何與醫院系統以 FHIR 標準對接」。

    參數：
        resource_type: Patient / Observation / AllergyIntolerance / MedicationStatement
    """
    rt = (resource_type or "").strip()
    # 不分大小寫對應
    match = next((k for k in _FHIR_RESOURCES if k.lower() == rt.lower()), None)
    if not match:
        return _dumps({
            "resource_type": resource_type, "found": False,
            "available": list(_FHIR_RESOURCES.keys()),
            "message": "未收錄此資源；目前支援 Patient / Observation / AllergyIntolerance / MedicationStatement。",
        })
    info = _FHIR_RESOURCES[match]
    return _dumps({
        "resource_type": match,
        "fhir_version": "R4",
        "pillar": info["pillar"],
        "purpose": info["purpose"],
        "key_fields": info["key_fields"],
        "note": "FHIR 為跨系統互通標準；各院 HIS/NIS/LIS/藥事 以對應資源交換資料。",
    })


if __name__ == "__main__":
    mcp.run()
