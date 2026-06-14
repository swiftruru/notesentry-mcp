// 驗證主行程 i18n：setLanguage('en') 後，匯出 Markdown 的標籤應為英文（tMain 跟著 config.language）。
import { readdirSync, readFileSync, rmSync } from 'node:fs'
const EXP = process.env.NS_EXPORT_TEST_DIR || '/tmp/ns_exp_i18n'
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

// 切到英文（持久化到 config，主行程 tMain 會讀到）
await evalJS(`await window.api.setLanguage('en'); return true`)
const conv = {
  id: 'cdp_i18n_exp', title: 'i18n export test', createdAt: Date.now(), updatedAt: Date.now(), model: 'gpt-oss:20b',
  messages: [
    { id: 'u', role: 'user', content: 'hello', createdAt: Date.now() },
    { id: 'a', role: 'assistant', content: 'hi there', toolCalls: [{ id: 'c', name: 'list_note_categories', args: {} }], createdAt: Date.now() },
    { id: 't', role: 'tool', content: '{"ok":true}', createdAt: Date.now() }
  ]
}
await evalJS(`return await window.api.exportMarkdown(${JSON.stringify(conv)})`)
await sleep(400)

const files = readdirSync(EXP).filter((f) => f.endsWith('.md'))
const md = files.length ? readFileSync(`${EXP}/${files[0]}`, 'utf-8') : ''
console.log(ok(md.includes('## 🧑 User')), '匯出標籤英文：User')
console.log(ok(md.includes('## 🤖 Assistant')), '匯出標籤英文：Assistant')
console.log(ok(md.includes('### 📊 Tool result')), '匯出標籤英文：Tool result')
console.log(ok(md.includes('Exported by NoteSentry')), '匯出 footer 英文')
console.log('--- 前 8 行 ---\n' + md.split('\n').slice(0, 8).join('\n'))

// 收尾：還原語言、清檔
await evalJS(`await window.api.setLanguage('zh-TW'); return true`)
for (const f of files) rmSync(`${EXP}/${f}`)
ws.close()
