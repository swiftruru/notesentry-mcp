// 重現：載入對話後切換活動列分頁，再切回「對話」，訊息是否還在？
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
const clickRail = (label) => evalJS(`const b=[...document.querySelectorAll('button')].find(x=>x.title===${JSON.stringify(label)}||x.innerText.trim()===${JSON.stringify(label)}); if(b)b.click(); return !!b;`)
const assistantVisible = (mark) => evalJS(`return [...document.querySelectorAll('.md')].some(d=>d.innerText.includes(${JSON.stringify(mark)}));`)
await send('Runtime.enable', {})
const ok = (b) => (b ? '✅' : '❌')

const MARK = 'TABKEEP777'
const conv = {
  id: 'cdp_tab_1', title: `分頁測試 ${MARK}`, createdAt: Date.now(), updatedAt: Date.now(),
  messages: [
    { id: 'u', role: 'user', content: `問題 ${MARK}`, createdAt: Date.now() },
    { id: 'a', role: 'assistant', content: `這是助理回答 ${MARK}，包含內容。`, createdAt: Date.now() }
  ]
}
await evalJS(`return await window.api.saveConversation(${JSON.stringify(conv)})`)
// 搜尋並載入
await evalJS(`
  const inp=document.querySelector('input[placeholder="搜尋對話…"]');
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  setter.call(inp, ${JSON.stringify(MARK)}); inp.dispatchEvent(new Event('input',{bubbles:true})); return true;
`)
await sleep(700)
await evalJS(`const it=[...document.querySelectorAll('div')].find(d=>(d.className||'').includes('cursor-pointer')&&d.innerText.includes(${JSON.stringify(MARK)})); if(it)it.click(); return !!it;`)
await sleep(500)
console.log(ok(await assistantVisible(MARK)), '載入後：助理訊息可見')

// 切到「工具」分頁
await clickRail('工具'); await sleep(400)
console.log(ok(!(await assistantVisible(MARK))), '切到「工具」：聊天區已換掉（預期看不到）')

// 切回「對話」分頁
await clickRail('對話'); await sleep(500)
const back = await assistantVisible(MARK)
console.log(ok(back), '切回「對話」：助理訊息是否還在？ → ' + (back ? '還在（正常）' : '不見了（BUG）'))

// 也記錄 store 狀態（透過 DOM：標題是否仍為該對話）
const title = await evalJS(`const h=document.querySelector('h1'); return h?h.innerText:null;`)
console.log('   目前標題列：', title)

await evalJS(`return await window.api.deleteConversation('cdp_tab_1')`)
ws.close()
