#!/usr/bin/env python3
"""NoteSentry 藥事輔助 MCP server（FastMCP / stdio）。

對應簡報「藥事-MCP：用藥史、交互作用」這一支柱。實現老師舉的例子——
「從 HIS 撈用藥史 → AI 分析 → 將警示推播給醫師」中的「分析→警示」部分。

設計原則（三層防線之資料層）：這些工具不做臨床判斷，而是把判斷「接地」到
確定性的內建知識（藥物交互作用表、過敏同類表）——零幻覺、可重現；最終仍由
醫師覆核。Input = 藥名清單（由 LLM 從病歷/提問擷取），Output = 結構化警示。

此 server 不需資料庫、不對外連線、無副作用（純查表）。
相依：pip install "mcp[cli]"
執行（stdio）：python3 mcp/servers/pharmacy_support_mcp_server.py
"""
from __future__ import annotations

import json
from typing import Annotated, List, Optional

from mcp.server.fastmcp import FastMCP
from pydantic import Field

mcp = FastMCP("pharmacy-support")


def _dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


def _norm(name: str) -> str:
    return (name or "").strip().lower()


# --- 藥物交互作用知識表（高頻、教學示範用；最終以院內藥典與藥師判斷為準）---
# key 為兩個藥（小寫、排序後）；value 為警示內容。
def _pair(a: str, b: str) -> tuple:
    return tuple(sorted((a, b)))


_INTERACTIONS = {
    _pair("warfarin", "aspirin"): {
        "severity": "major",
        "mechanism": "兩者皆增加出血風險（抗凝＋抗血小板），並競爭蛋白結合位。",
        "recommendation": "避免併用或嚴密監測 INR 與出血徵象；如需併用應由醫師評估。",
    },
    _pair("warfarin", "ibuprofen"): {
        "severity": "major",
        "mechanism": "NSAID 抑制血小板並刺激胃黏膜，與 warfarin 併用顯著增加消化道出血。",
        "recommendation": "避免併用；必要時改用 acetaminophen 並監測。",
    },
    _pair("warfarin", "amiodarone"): {
        "severity": "major",
        "mechanism": "amiodarone 抑制 CYP2C9，升高 warfarin 血中濃度→出血。",
        "recommendation": "warfarin 通常需減量並密集監測 INR。",
    },
    _pair("clopidogrel", "omeprazole"): {
        "severity": "moderate",
        "mechanism": "omeprazole 抑制 CYP2C19，降低 clopidogrel 活化→抗血小板效果下降。",
        "recommendation": "改用 pantoprazole 等對 CYP2C19 影響較小者。",
    },
    _pair("lisinopril", "spironolactone"): {
        "severity": "major",
        "mechanism": "ACEi 加上保鉀利尿劑→高血鉀風險。",
        "recommendation": "監測血鉀與腎功能；避免同時加用其他保鉀製劑。",
    },
    _pair("lisinopril", "potassium"): {
        "severity": "major",
        "mechanism": "ACEi 與鉀補充併用→高血鉀。",
        "recommendation": "監測血鉀，避免不必要的鉀補充。",
    },
    _pair("simvastatin", "clarithromycin"): {
        "severity": "major",
        "mechanism": "macrolide 抑制 CYP3A4，升高 statin 濃度→橫紋肌溶解風險。",
        "recommendation": "治療期間暫停 statin 或改用不經 CYP3A4 者。",
    },
    _pair("methotrexate", "trimethoprim"): {
        "severity": "major",
        "mechanism": "兩者皆為抗葉酸，併用→骨髓抑制。",
        "recommendation": "避免併用。",
    },
    _pair("ciprofloxacin", "ondansetron"): {
        "severity": "moderate",
        "mechanism": "兩者皆延長 QT 間期，併用→尖端扭轉型室速風險。",
        "recommendation": "評估 QT 與電解質，避免其他延長 QT 藥物。",
    },
    _pair("tramadol", "sertraline"): {
        "severity": "moderate",
        "mechanism": "皆增加血清素→血清素症候群風險。",
        "recommendation": "注意躁動、發抖、體溫升高等徵象。",
    },
}

# 同義詞 → 標準名（讓使用者用常見寫法也能命中）
_ALIASES = {
    "asa": "aspirin",
    "acetylsalicylic acid": "aspirin",
    "coumadin": "warfarin",
    "advil": "ibuprofen",
    "motrin": "ibuprofen",
    "plavix": "clopidogrel",
    "prilosec": "omeprazole",
    "zocor": "simvastatin",
    "biaxin": "clarithromycin",
    "zofran": "ondansetron",
}


def _canon(name: str) -> str:
    n = _norm(name)
    return _ALIASES.get(n, n)


@mcp.tool()
def check_drug_interactions(
    drugs: Annotated[
        List[str], Field(description="藥物名稱清單（學名或常見品名），例：[\"warfarin\", \"aspirin\"]。")
    ],
) -> str:
    """檢查一份藥物清單中是否有已知的藥物交互作用（確定性查表，零幻覺）。

    對應老師例子的「分析→警示」：給定病患用藥清單，回傳兩兩之間的交互作用警示。

    參數：
        drugs: 藥名清單（學名或常見商品名皆可），例：["warfarin", "aspirin"]
    回傳：每組命中的 severity(major/moderate/minor)、機轉、處置建議。
    """
    canon = [_canon(d) for d in (drugs or []) if _norm(d)]
    seen = []
    findings = []
    n = len(canon)
    for i in range(n):
        for j in range(i + 1, n):
            key = _pair(canon[i], canon[j])
            if key in _INTERACTIONS and key not in seen:
                seen.append(key)
                info = _INTERACTIONS[key]
                findings.append({
                    "drug_a": canon[i],
                    "drug_b": canon[j],
                    "severity": info["severity"],
                    "mechanism": info["mechanism"],
                    "recommendation": info["recommendation"],
                })

    order = {"major": 3, "moderate": 2, "minor": 1}
    findings.sort(key=lambda f: order.get(f["severity"], 0), reverse=True)
    overall = findings[0]["severity"] if findings else "none"

    return _dumps({
        "checked_drugs": canon,
        "interaction_count": len(findings),
        "highest_severity": overall,
        "interactions": findings,
        "note": "僅比對內建高頻交互作用表；未列出不代表安全。"
        if findings else "在內建知識表中未發現已知交互作用（不代表絕對安全）。",
        "disclaimer": "此為用藥安全輔助，非處方建議；最終由醫師與藥師確認。",
    })


# --- 過敏同類表（過敏原 → 同類/交叉反應藥）---
_ALLERGY_CLASSES = {
    "penicillin": ["amoxicillin", "ampicillin", "piperacillin", "penicillin", "augmentin"],
    "sulfa": ["sulfamethoxazole", "trimethoprim-sulfamethoxazole", "bactrim", "sulfasalazine"],
    "nsaid": ["ibuprofen", "naproxen", "ketorolac", "aspirin", "diclofenac"],
    "cephalosporin": ["cephalexin", "ceftriaxone", "cefazolin"],
}


@mcp.tool()
def check_allergy_conflict(
    prescribed: Annotated[
        List[str], Field(description="擬開立的處方藥清單，例：[\"amoxicillin\"]。")
    ],
    allergies: Annotated[
        List[str], Field(description="病患已知過敏史（藥名或藥物類別），例：[\"penicillin\"]。")
    ],
) -> str:
    """比對「擬開立處方」與「已知過敏史」，標出可能的過敏/交叉反應衝突（查表，零幻覺）。

    參數：
        prescribed: 擬開立的藥名清單，例：["amoxicillin"]
        allergies:  已知過敏原清單，例：["penicillin"]
    回傳：每筆衝突的過敏原、衝突藥、所屬類別與建議。
    """
    rx = [_canon(d) for d in (prescribed or []) if _norm(d)]
    al = [_norm(a) for a in (allergies or []) if _norm(a)]
    conflicts = []
    for allergen in al:
        members = _ALLERGY_CLASSES.get(allergen)
        # 也允許過敏原本身就是某類別成員（反查類別）
        classes = [allergen] if members else [
            c for c, ms in _ALLERGY_CLASSES.items() if allergen in ms
        ]
        for cls in classes:
            for drug in rx:
                if drug in _ALLERGY_CLASSES.get(cls, []):
                    conflicts.append({
                        "allergy": allergen,
                        "conflicting_drug": drug,
                        "drug_class": cls,
                        "severity": "major",
                        "recommendation": f"病患對 {allergen} 過敏，{drug} 屬同類（{cls}），"
                                          f"有交叉反應風險，建議改用替代藥並確認過敏史。",
                    })

    return _dumps({
        "prescribed": rx,
        "allergies": al,
        "conflict_count": len(conflicts),
        "conflicts": conflicts,
        "note": "未發現衝突不代表絕對安全；僅比對內建同類/交叉反應表。"
        if not conflicts else "偵測到過敏交叉反應風險，請醫師覆核。",
        "disclaimer": "此為用藥安全輔助，非處方建議；最終由醫師與藥師確認。",
    })


# --- 單藥參考（知識接地；未收錄就明說，不亂編）---
_DRUG_REF = {
    "warfarin": {"class": "抗凝血劑（vitamin K antagonist）",
                 "watch": ["出血徵象", "INR 監測", "與抗血小板/NSAID/某些抗生素交互"]},
    "aspirin": {"class": "抗血小板／NSAID",
                "watch": ["消化道出血", "與抗凝劑併用風險", "雷氏症候群（兒童）"]},
    "amoxicillin": {"class": "penicillin 類抗生素",
                    "watch": ["penicillin 過敏者禁用", "腸胃不適"]},
    "lisinopril": {"class": "ACE 抑制劑",
                   "watch": ["高血鉀", "乾咳", "腎功能", "與保鉀利尿劑/鉀補充交互"]},
    "simvastatin": {"class": "HMG-CoA 還原酶抑制劑（statin）",
                    "watch": ["肌肉痛/橫紋肌溶解", "與 CYP3A4 抑制劑交互"]},
}


@mcp.tool()
def get_drug_reference(
    drug: Annotated[str, Field(description="單一藥物名稱（學名或常見品名），例：warfarin。")],
) -> str:
    """查單一藥物的類別與注意事項（內建知識；未收錄就明說，不臆造）。

    參數：
        drug: 藥名（學名或常見商品名）。
    """
    key = _canon(drug)
    ref = _DRUG_REF.get(key)
    if not ref:
        return _dumps({
            "drug": drug, "found": False,
            "message": "內建知識表未收錄此藥；請改用院內藥典查詢，勿臆造。",
        })
    return _dumps({
        "drug": key, "found": True,
        "class": ref["class"], "watch": ref["watch"],
        "disclaimer": "此為用藥參考，非處方建議；最終由醫師與藥師確認。",
    })


if __name__ == "__main__":
    mcp.run()
