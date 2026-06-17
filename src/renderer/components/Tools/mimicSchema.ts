/**
 * MIMIC-III `notes` 資料表（NOTEEVENTS）的欄位字典。
 * 對齊 mcp/scripts/build_db.py 的 COLUMNS / SCHEMA / INT_COLUMNS。
 * 注意：這裡只放「公開 schema 文件」（欄位名稱／型別／意義），不含任何實際病患資料，符合 PhysioNet DUA。
 * 各欄「說明」走 i18n（tools.json 的 schema.col.<NAME>），可雙語。
 */
export interface SchemaColumn {
  name: string
  type: 'INTEGER' | 'TEXT'
}

export const MIMIC_NOTES_COLUMNS: readonly SchemaColumn[] = [
  { name: 'ROW_ID', type: 'INTEGER' },
  { name: 'SUBJECT_ID', type: 'INTEGER' },
  { name: 'HADM_ID', type: 'INTEGER' },
  { name: 'CHARTDATE', type: 'TEXT' },
  { name: 'CHARTTIME', type: 'TEXT' },
  { name: 'STORETIME', type: 'TEXT' },
  { name: 'CATEGORY', type: 'TEXT' },
  { name: 'DESCRIPTION', type: 'TEXT' },
  { name: 'CGID', type: 'INTEGER' },
  { name: 'ISERROR', type: 'INTEGER' },
  { name: 'TEXT', type: 'TEXT' }
] as const
