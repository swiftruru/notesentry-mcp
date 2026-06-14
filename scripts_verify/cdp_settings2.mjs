// 驗證：偵測按鈕不再直書 + 連線測試功能。
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

// 進設定頁
await evalJS(`const b=[...document.querySelectorAll('button')].find(x=>x.title==='設定'||x.innerText.trim()==='設定'); if(b)b.click(); return !!b;`)
await sleep(1600)

// 1) 偵測按鈕：白字不換行、單行高度
const btn = await evalJS(`
  const b=[...document.querySelectorAll('button')].find(x=>(x.title||'').includes('偵測'));
  if(!b) return null;
  const cs=getComputedStyle(b);
  return { ws: cs.whiteSpace, h: b.offsetHeight, w: b.offsetWidth, lines: b.getClientRects().length, text: b.innerText.replace(/\\s+/g,'') };
`)
console.log(ok(btn && btn.ws === 'nowrap'), `偵測按鈕 white-space=${btn?.ws}（nowrap 表示不換行）`)
console.log(ok(btn && btn.h <= 40), `按鈕高度 ${btn?.h}px（單行約 36px，過高代表直書）`)

// 2) 連線測試
await evalJS(`const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('連線測試')); if(b)b.click(); return !!b;`)
let panel = null
for (let i = 0; i < 40; i++) {
  panel = await evalJS(`
    const el=[...document.querySelectorAll('div')].find(d=>d.innerText.includes('連線測試結果'));
    if(!el) return null;
    return el.innerText;
  `)
  if (panel) break
  await sleep(1000)
}
console.log(ok(!!panel), '連線測試結果面板出現')
if (panel) console.log('--- 面板內容 ---\n' + panel + '\n----------------')
console.log(ok(panel && panel.includes('Ollama')), '含 Ollama 測試列')
console.log(ok(panel && (panel.includes('MIMIC') || panel.includes('臨床輔助'))), '含 MCP server 測試列')

ws.close()
