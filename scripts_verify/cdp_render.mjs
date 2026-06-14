// 透過 CDP 驗證「真實 app 內」的 Markdown/程式碼渲染與訊息操作鈕（不需模型，純前端渲染管線）。
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

const MARK = 'RENDERZZ'
const mdContent = [
  '## 檢傷重點',
  '',
  '| 級別 | 名稱 | 時限 |',
  '| --- | --- | --- |',
  '| 1 | 復甦 | 立即 |',
  '| 2 | 危急 | 10 分鐘 |',
  '',
  '- **粗體**項目',
  '- 一般項目',
  '',
  '```python',
  'print("hello ECG")',
  '```'
].join('\n')

const conv = {
  id: 'cdp_render_1',
  title: `渲染測試 ${MARK}`,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [
    { id: 'u1', role: 'user', content: `渲染測試 ${MARK}`, createdAt: Date.now() },
    { id: 'a1', role: 'assistant', content: mdContent, createdAt: Date.now() }
  ]
}

await evalJS(`return await window.api.saveConversation(${JSON.stringify(conv)})`)
console.log('✅ 已存入含 Markdown 的對話')

// 在搜尋框輸入唯一標記 → 觸發 store.searchConversations → 清單出現該對話
await evalJS(`
  const inp=document.querySelector('input[placeholder="搜尋對話…"]');
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  setter.call(inp, ${JSON.stringify(MARK)});
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
`)
await sleep(700)

const clicked = await evalJS(`
  const items=[...document.querySelectorAll('div')].filter(d=>(d.className||'').includes('cursor-pointer') && d.innerText.includes(${JSON.stringify(MARK)}));
  if(items.length){ items[0].click(); return true } return false;
`)
console.log(ok(clicked), '在清單點開該對話')
await sleep(600)

const r = await evalJS(`
  const m=[...document.querySelectorAll('.md')].pop();
  if(!m) return null;
  return {
    table: !!m.querySelector('table'),
    rows: m.querySelectorAll('table tr').length,
    list: !!m.querySelector('ul li'),
    strong: !!m.querySelector('strong'),
    codeBlock: !!m.querySelector('pre code'),
    hljs: !!m.querySelector('pre code span') || (m.querySelector('pre code')?.className||'').includes('hljs'),
    copyCodeBtn: !!document.querySelector('button[title="複製程式碼"]'),
    copyMsgBtn: !!document.querySelector('button[title="複製訊息"]')
  };
`)
console.log(ok(r && r.table && r.rows >= 3), `表格渲染（${r?.rows} 列）`)
console.log(ok(r && r.list), '清單渲染')
console.log(ok(r && r.strong), '粗體渲染')
console.log(ok(r && r.codeBlock), '程式碼區塊渲染')
console.log(ok(r && r.hljs), '程式碼語法高亮（hljs span）')
console.log(ok(r && r.copyCodeBtn), '「複製程式碼」鈕存在')
console.log(ok(r && r.copyMsgBtn), '「複製訊息」鈕存在')

// 收尾：刪掉測試對話
await evalJS(`return await window.api.deleteConversation('cdp_render_1')`)
ws.close()
console.log('\nMarkdown 渲染驗證完成（細節：' + JSON.stringify(r) + '）')
