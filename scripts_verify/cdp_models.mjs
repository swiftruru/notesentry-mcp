// 驗證「偵測模型 + 下拉選單」：真實 IPC 列出本機 Ollama 模型 + 設定頁渲染下拉選單。
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

// 1) 真實 IPC：列出本機已安裝模型
const models = await evalJS(`return await window.api.listModels()`)
console.log(ok(Array.isArray(models) && models.length > 0), `listModels() 回傳 ${models.length} 個模型：${JSON.stringify(models)}`)
console.log(ok(models.includes('gpt-oss:20b')), '清單含 gpt-oss:20b')

// 2) 點活動列「設定」→ 等自動偵測 → 檢查下拉選單
await evalJS(`
  const b=[...document.querySelectorAll('button')].find(x=>x.title==='設定'||x.innerText.trim()==='設定');
  if(b) b.click(); return !!b;
`)
await sleep(1500)

const ui = await evalJS(`
  const sel=document.querySelector('select');
  const opts=sel?[...sel.options].map(o=>o.value):[];
  const detectBtn=[...document.querySelectorAll('button')].some(b=>(b.title||'').includes('偵測'));
  return { hasSelect: !!sel, optionCount: opts.length, hasCustom: opts.includes('__custom__'),
           hasGptoss: opts.includes('gpt-oss:20b'), selected: sel?sel.value:null, detectBtn };
`)
console.log(ok(ui.hasSelect), '設定頁出現下拉選單（select）')
console.log(ok(ui.hasGptoss), `下拉含偵測到的模型（gpt-oss:20b），共 ${ui.optionCount} 個選項`)
console.log(ok(ui.hasCustom), '下拉含「自訂…」選項')
console.log(ok(ui.detectBtn), '「偵測」按鈕存在')
console.log(ok(ui.selected === 'gpt-oss:20b'), `目前選中：${ui.selected}`)

ws.close()
console.log('\n模型下拉驗證完成：' + JSON.stringify(ui))
