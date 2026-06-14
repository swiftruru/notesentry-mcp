// 驗證 Markdown 匯出：載入一段含工具呼叫/結果/表格的對話 → 點「匯出」→ 檢查產出的 .md。
import { readdirSync, readFileSync, rmSync } from 'node:fs'
const EXP_DIR = process.env.NS_EXPORT_TEST_DIR || '/tmp/ns_exp'
const BASE = 'http://127.0.0.1:9222'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const list = await (await fetch(BASE + '/json')).json()
const target = list.find((x) => x.type === 'page' && x.webSocketDebuggerUrl)
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
function send(method, params) { return new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) }) }
async function evalJS(body) {
  const m = await send('Runtime.evaluate', { expression: `(async()=>{${body}})()`, awaitPromise: true, returnByValue: true })
  const r = m.result
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails))
  return r.result.value
}
await send('Runtime.enable', {})
const ok = (b) => (b ? '✅' : '❌')

const MARK = 'EXPMARK'
const conv = {
  id: 'cdp_export_1', title: `${MARK} 匯出測試`, createdAt: Date.now(), updatedAt: Date.now(), model: 'gpt-oss:20b',
  messages: [
    { id: 'u', role: 'user', content: `各類別各有多少筆紀錄？ ${MARK}`, createdAt: Date.now() },
    { id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'list_note_categories', args: {} }], createdAt: Date.now() },
    { id: 't', role: 'tool', content: '{"total_notes":2083180}', toolCallId: 'c1', createdAt: Date.now() },
    { id: 'a2', role: 'assistant', content: '## 結果\n\n| 類別 | 筆數 |\n| --- | --- |\n| Nursing/other | 822497 |', createdAt: Date.now() }
  ]
}
await evalJS(`return await window.api.saveConversation(${JSON.stringify(conv)})`)
// 載入（設為 active）
await evalJS(`
  const inp=document.querySelector('input[placeholder="搜尋對話…"]');
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  setter.call(inp, ${JSON.stringify(MARK)}); inp.dispatchEvent(new Event('input',{bubbles:true})); return true;
`)
await sleep(700)
await evalJS(`const it=[...document.querySelectorAll('div')].find(d=>(d.className||'').includes('cursor-pointer')&&d.innerText.includes(${JSON.stringify(MARK)})); if(it)it.click(); return !!it;`)
await sleep(500)

// 點「匯出」按鈕
const clicked = await evalJS(`const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='匯出'); if(b)b.click(); return !!b;`)
console.log(ok(clicked), '點擊「匯出」按鈕')
await sleep(800)

// 讀產出的 .md（headless 測試路徑）
const files = readdirSync(EXP_DIR).filter((f) => f.endsWith('.md'))
console.log(ok(files.length > 0), `產出 Markdown 檔：${files.join(', ')}`)
const md = files.length ? readFileSync(`${EXP_DIR}/${files[0]}`, 'utf-8') : ''
const checks = {
  '標題 H1': md.startsWith(`# ${MARK} 匯出測試`),
  '匯出抬頭': md.includes('NoteSentry 對話匯出'),
  '使用者段': md.includes('## 🧑 使用者') && md.includes('各類別各有多少筆紀錄'),
  '助理段': md.includes('## 🤖 助理'),
  '工具呼叫': md.includes('list_note_categories') && md.includes('```json'),
  '工具結果': md.includes('### 📊 工具結果') && md.includes('2083180'),
  '表格內容': md.includes('| 類別 | 筆數 |')
}
for (const [k, v] of Object.entries(checks)) console.log(ok(v), k)

// 顯示前幾行供肉眼確認
console.log('\n--- 匯出檔前 12 行 ---')
console.log(md.split('\n').slice(0, 12).join('\n'))

// 收尾：刪測試對話 + 匯出檔（精確）
await evalJS(`return await window.api.deleteConversation('cdp_export_1')`)
for (const f of files) rmSync(`${EXP_DIR}/${f}`)
ws.close()
