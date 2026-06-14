// 驗證：起始問句可點 + 後續建議（IPC 直測 + 真實一輪後動態建議出現）。
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

// 1) IPC 直測 suggestFollowups
const conv = JSON.stringify([
  { id: 'u', role: 'user', content: '各類別各有多少筆紀錄？', createdAt: 0 },
  { id: 'a', role: 'assistant', content: '共 15 類，最多是 Nursing/other（822,497）、Radiology（522,279）。', createdAt: 0 }
])
const tips = await evalJS(`return await window.api.suggestFollowups(${conv})`)
console.log(ok(Array.isArray(tips) && tips.length >= 1 && tips.length <= 3), `suggestFollowups 回傳 ${tips.length} 條建議`)
tips.forEach((t) => console.log('   •', t))

// 2) 起始問句是否為可點按鈕
const starter = await evalJS(`
  const btns=[...document.querySelectorAll('button')].filter(b=>b.innerText.includes('各類別各有多少筆紀錄'));
  return btns.length;
`)
console.log(ok(starter > 0), `空狀態起始問句為可點按鈕（找到 ${starter} 個）`)

// 3) 點起始問句 → 應加入 user 訊息並開始串流
await evalJS(`
  const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('各類別各有多少筆紀錄'));
  if(b) b.click(); return !!b;
`)
await sleep(800)
const afterClick = await evalJS(`
  const userBubble=[...document.querySelectorAll('div')].some(d=>(d.className||'').includes('bg-brand') && d.innerText.includes('各類別各有多少筆紀錄'));
  const streaming=!![...document.querySelectorAll('button')].find(b=>b.title==='停止');
  return { userBubble, streaming };
`)
console.log(ok(afterClick.userBubble), '點擊後出現使用者訊息泡泡')
console.log(ok(afterClick.streaming), '點擊後開始串流（送出成功）')

// 4) 自動核可 HITL，等該輪完成 → 等動態建議列出現
let approvals = 0
for (let i = 0; i < 240; i++) {
  const st = await evalJS(`
    const ap=[...document.querySelectorAll('button')].find(b=>b.innerText.includes('同意並執行'));
    if(ap){ ap.click(); return 'A'; }
    const streaming=!![...document.querySelectorAll('button')].find(b=>b.title==='停止');
    const bar=[...document.querySelectorAll('div')].some(d=>d.innerText.includes('建議接著問'));
    return JSON.stringify({streaming, bar});
  `)
  if (st === 'A') { approvals++; await sleep(700); continue }
  const s = JSON.parse(st)
  if (s.bar) break
  if (!s.streaming && i > 5) {
    // 串流已結束，再多等建議生成（另一次推論）
  }
  await sleep(1000)
}
const bar = await evalJS(`
  const labels=[...document.querySelectorAll('div')].filter(d=>d.innerText.trim().startsWith('建議接著問'));
  const host=labels[labels.length-1];
  if(!host) return null;
  // 找同層的建議晶片按鈕
  const wrap=host.parentElement;
  const chips=[...wrap.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean);
  return chips;
`)
console.log(ok(bar && bar.length >= 1), `動態「建議接著問」列出現（${approvals} 次核可）：${JSON.stringify(bar)}`)

ws.close()
