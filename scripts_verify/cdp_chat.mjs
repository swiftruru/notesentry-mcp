// 透過 CDP 驅動「真實的一輪對話」：打字→送出→自動核可 HITL→等回答→驗證 Markdown 與持久化。
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

const QUESTION = '各類別各有多少筆紀錄？請用表格列出前五大類別。'

// 1) 在 textarea 填入問題並按送出（React 受控 input：用原生 setter + input 事件）
await evalJS(`
  const ta=document.querySelector('textarea');
  const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
  setter.call(ta, ${JSON.stringify(QUESTION)});
  ta.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,50));
  const btn=[...document.querySelectorAll('button')].find(b=>b.title==='送出');
  btn.click();
  return true;
`)
console.log('✅ 已送出問題：', QUESTION)

// 2) 輪詢：出現覆核框就按「同意並執行」；直到串流結束且有 assistant 內容
let approvals = 0
let done = false
for (let i = 0; i < 360; i++) {
  const state = await evalJS(`
    const approve=[...document.querySelectorAll('button')].find(b=>b.innerText.includes('同意並執行'));
    if(approve){ approve.click(); return 'APPROVED'; }
    const streaming = !![...document.querySelectorAll('button')].find(b=>b.title==='停止');
    const md = document.querySelector('.md');
    return JSON.stringify({streaming, hasMd: !!md});
  `)
  if (state === 'APPROVED') {
    approvals++
    console.log(`🔔 偵測到覆核框 → 已自動按「同意並執行」（第 ${approvals} 次）`)
    await sleep(800)
    continue
  }
  const s = JSON.parse(state)
  if (!s.streaming && s.hasMd) { done = true; break }
  await sleep(1000)
}

const ok = (b) => (b ? '✅' : '❌')
console.log(ok(done), `對話完成（HITL 核可 ${approvals} 次）`)

// 3) 驗證 Markdown 真的被渲染成 HTML 元素
const mdInfo = await evalJS(`
  const md=[...document.querySelectorAll('.md')].pop();
  if(!md) return null;
  return { hasTable: !!md.querySelector('table'), hasList: !!md.querySelector('ul,ol'),
           hasStrong: !!md.querySelector('strong'), text: md.innerText.slice(0,120) };
`)
console.log(ok(mdInfo && (mdInfo.hasTable || mdInfo.hasList || mdInfo.hasStrong)),
  'Markdown 已渲染為 HTML：', JSON.stringify(mdInfo))

// 4) 驗證對話已持久化，且有「即時標題」（由首句擷取）
const convs = await evalJS(`return await window.api.listConversations()`)
const mine = convs.find((c) => (c.preview || '').includes('各類別') || c.title.includes('各類別'))
console.log(ok(!!mine), '對話已持久化：', mine ? `標題「${mine.title}」、${mine.messageCount} 則訊息` : '(找不到)')

ws.close()
console.log('\nCDP 對話驗證完成。')
