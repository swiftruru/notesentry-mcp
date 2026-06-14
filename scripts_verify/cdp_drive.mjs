// 透過 Chrome DevTools Protocol 驅動執行中的 NoteSentry，
// 用「真實的 window.api」走完整 IPC → conversationStore → 磁碟路徑來驗證對話功能。
const BASE = 'http://127.0.0.1:9222'

async function getPageTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(BASE + '/json')).json()
      const t = list.find((x) => x.type === 'page' && x.webSocketDebuggerUrl)
      if (t) return t
    } catch {
      /* 還沒起來 */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('找不到可連線的 page target')
}

const target = await getPageTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let id = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
}
function send(method, params) {
  return new Promise((res) => {
    const i = ++id
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
}
async function evalJS(body) {
  const m = await send('Runtime.evaluate', {
    expression: `(async()=>{${body}})()`,
    awaitPromise: true,
    returnByValue: true
  })
  const r = m.result
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails))
  return r.result.value
}

await send('Runtime.enable', {})

const ok = (b) => (b ? '✅' : '❌')

// 1) 新版 UI 是否掛載（活動列 + 對話清單）
const bodyText = await evalJS(`return document.body.innerText`)
console.log(ok(bodyText.includes('對話') && bodyText.includes('工具') && bodyText.includes('稽核') && bodyText.includes('設定')), '活動列四個項目已渲染')
console.log(ok(bodyText.includes('新對話')), '對話清單「新對話」按鈕已渲染')

// 2) 透過真實 IPC 存一段對話（含 Markdown 內文）
const conv = {
  id: 'cdp_test_1',
  title: '即時標題：胸痛評估',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  model: 'qwen3.6:27b',
  messages: [
    { id: 'u1', role: 'user', content: '一位胸痛病人怎麼評估？', createdAt: Date.now() },
    { id: 'a1', role: 'assistant', content: '## 評估\n- 生命徵象\n- 心電圖\n\n```py\nprint("ECG")\n```', createdAt: Date.now() }
  ]
}
const savedMeta = await evalJS(`return await window.api.saveConversation(${JSON.stringify(conv)})`)
console.log(ok(savedMeta && savedMeta.id === 'cdp_test_1' && savedMeta.messageCount === 2), '儲存對話（真實 IPC）→ 回傳中繼資料', JSON.stringify(savedMeta))

// 3) 列表
const list = await evalJS(`return await window.api.listConversations()`)
console.log(ok(list.some((c) => c.id === 'cdp_test_1')), `列出對話：共 ${list.length} 筆，含新存的`)

// 4) 載入完整對話
const loaded = await evalJS(`return await window.api.loadConversation('cdp_test_1')`)
console.log(ok(loaded && loaded.messages.length === 2 && loaded.messages[1].content.includes('```py')), '載入對話：訊息與 Markdown 內文完整')

// 5) 搜尋（內文掃描）
const found = await evalJS(`return (await window.api.searchConversations('心電圖')).map(c=>c.id)`)
console.log(ok(found.includes('cdp_test_1')), `搜尋內文「心電圖」命中：${JSON.stringify(found)}`)
const notFound = await evalJS(`return (await window.api.searchConversations('絕對不存在的字串zzz')).length`)
console.log(ok(notFound === 0), `搜尋不存在字串 → ${notFound} 筆`)

// 6) 改名
await evalJS(`return await window.api.renameConversation('cdp_test_1','改名後標題')`)
const afterRename = await evalJS(`return (await window.api.listConversations()).find(c=>c.id==='cdp_test_1').title`)
console.log(ok(afterRename === '改名後標題'), `改名 → 「${afterRename}」`)

// 7) 刪除
await evalJS(`return await window.api.deleteConversation('cdp_test_1')`)
const afterDel = await evalJS(`return (await window.api.listConversations()).some(c=>c.id==='cdp_test_1')`)
console.log(ok(afterDel === false), '刪除 → 已從清單移除')

ws.close()
console.log('\nCDP 驗證完成。')
