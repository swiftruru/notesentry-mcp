// 驗證：載入舊對話時自動產生一次「建議接著問」。
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

const MARK = 'LOADSUGG'
const conv = {
  id: 'cdp_loadsugg_1',
  title: `載入建議測試 ${MARK}`,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [
    { id: 'u', role: 'user', content: `各類別各有多少筆紀錄？ ${MARK}`, createdAt: Date.now() },
    { id: 'a', role: 'assistant', content: '共 15 類，最多是 Nursing/other（822,497）、Radiology（522,279）、Nursing（223,556）。', createdAt: Date.now() }
  ]
}
await evalJS(`return await window.api.saveConversation(${JSON.stringify(conv)})`)
console.log('✅ 已存入一段舊對話')

// 搜尋 → 點開（觸發 loadConversation）
await evalJS(`
  const inp=document.querySelector('input[placeholder="搜尋對話…"]');
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  setter.call(inp, ${JSON.stringify(MARK)}); inp.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
`)
await sleep(700)
const clicked = await evalJS(`
  const items=[...document.querySelectorAll('div')].filter(d=>(d.className||'').includes('cursor-pointer') && d.innerText.includes(${JSON.stringify(MARK)}));
  if(items.length){ items[0].click(); return true } return false;
`)
console.log(ok(clicked), '點開舊對話（觸發載入）')

// 等「建議接著問」列出現（延遲 600ms + 一次推論）
let chips = null
for (let i = 0; i < 90; i++) {
  chips = await evalJS(`
    const labels=[...document.querySelectorAll('div')].filter(d=>d.innerText.trim().startsWith('建議接著問'));
    const host=labels[labels.length-1];
    if(!host) return null;
    const c=[...host.parentElement.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean);
    return c.length?c:null;
  `)
  if (chips) break
  await sleep(1000)
}
console.log(ok(chips && chips.length >= 1), `載入後出現「建議接著問」：${JSON.stringify(chips)}`)

await evalJS(`return await window.api.deleteConversation('cdp_loadsugg_1')`)
ws.close()
