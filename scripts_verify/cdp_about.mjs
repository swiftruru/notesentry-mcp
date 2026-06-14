// 開啟「關於」頁，驗證內容並截圖。
import { writeFileSync } from 'node:fs'
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
await send('Page.enable', {})
const ok = (b) => (b ? '✅' : '❌')

// 點活動列「關於」
await evalJS(`const b=[...document.querySelectorAll('button')].find(x=>x.title==='關於'||x.innerText.trim()==='關於'); if(b)b.click(); return !!b;`)
await sleep(600)

const text = await evalJS(`return document.querySelector('main')?.innerText || ''`)
const checks = {
  'App 名稱 NoteSentry': text.includes('NoteSentry'),
  '研究生 潘昱如': text.includes('潘昱如'),
  '資料決策分析實驗室': text.includes('資料決策分析實驗室'),
  '國立臺北護理健康大學': text.includes('國立臺北護理健康大學'),
  '隱私核心': text.includes('資料全程留在本機'),
  '設計原則三層': text.includes('接地') && text.includes('覆核') && text.includes('留痕'),
  '技術堆疊': text.includes('技術堆疊') && text.includes('Ollama'),
  '資料來源': text.includes('MIMIC-III')
}
for (const [k, v] of Object.entries(checks)) console.log(ok(v), k)

// 截圖
const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result?.data) {
  writeFileSync('/tmp/ns_about.png', Buffer.from(shot.result.data, 'base64'))
  console.log('📸 已截圖 → /tmp/ns_about.png')
}
ws.close()
