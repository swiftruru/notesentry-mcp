// HITL 核可仲介：每個工具呼叫在實際執行前，都會在這裡建立一個 pending Promise，
// 直到渲染端回傳「同意/拒絕」才 resolve。這是強制流程，無任何繞過途徑。

interface Pending {
  resolve: (approved: boolean) => void
}

const pending = new Map<string, Pending>()
let seq = 0

/** 產生一個唯一的核可 id（非隨機，避免依賴 Math.random）。 */
export function nextApprovalId(): string {
  seq += 1
  return `apr_${seq}_${process.pid}`
}

/**
 * 等待人類核可。回傳 Promise<boolean>：true=同意、false=拒絕。
 * caller 取得 approvalId 後應立即透過 IPC 通知渲染端跳出確認框。
 */
export function waitForApproval(approvalId: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    pending.set(approvalId, { resolve })
  })
}

/** 渲染端回覆核可結果。找不到對應 id 則忽略（可能已逾時/取消）。 */
export function resolveApproval(approvalId: string, approved: boolean): void {
  const p = pending.get(approvalId)
  if (!p) return
  pending.delete(approvalId)
  p.resolve(approved)
}

/** 連線中斷或 session 取消時，把所有未決核可一律視為拒絕。 */
export function rejectAllPending(): void {
  for (const [, p] of pending) p.resolve(false)
  pending.clear()
}
