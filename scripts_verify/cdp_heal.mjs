// 驗證孤兒索引自我修復：存對話 → 只刪「該對話的檔案」(精確檔名) → 清單應自動剔除。
import { unlinkSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = 'http://127.0.0.1:9222'
const list0 = await (await fetch(BASE + '/json')).json()
const target = list0.find((x) => x.type === 'page' && x.webSocketDebuggerUrl)
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

const HEAL_ID = 'cdp_heal_1'
const HEAL_FILE = resolve('conversations', `${HEAL_ID}.json`) // 精確檔名，不用萬用字元

const conv = {
  id: HEAL_ID, title: '自我修復測試', createdAt: Date.now(), updatedAt: Date.now(),
  messages: [{ id: 'u', role: 'user', content: 'hi', createdAt: Date.now() }, { id: 'a', role: 'assistant', content: 'hello', createdAt: Date.now() }]
}
await evalJS(`return await window.api.saveConversation(${JSON.stringify(conv)})`)
const before = await evalJS(`return (await window.api.listConversations()).some(c=>c.id==='${HEAL_ID}')`)
console.log(ok(before), '存檔後清單含該對話')

// 只刪「這一個檔」(精確路徑)，模擬檔案遺失
if (existsSync(HEAL_FILE)) unlinkSync(HEAL_FILE)
console.log(ok(!existsSync(HEAL_FILE)), '已移除該對話的檔案（精確檔名）')

// 再列一次 → 應自我修復（剔除孤兒項）
const after = await evalJS(`return (await window.api.listConversations()).some(c=>c.id==='${HEAL_ID}')`)
console.log(ok(!after), '再次列出時，孤兒項已被自動剔除')

const idxRaw = readFileSync(resolve('conversations', 'index.json'), 'utf-8')
console.log(ok(!idxRaw.includes(HEAL_ID)), 'index.json 已不含孤兒項')

ws.close()
