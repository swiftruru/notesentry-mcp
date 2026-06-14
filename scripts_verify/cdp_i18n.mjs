// 驗證 i18n：預設 zh-TW → 點右上 toggle 切 en → 全 UI 切換、config 持久化 → 切回。
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

const bodyText = () => evalJS(`return document.body.innerText`)

// 1) 預設 zh-TW
let txt = await bodyText()
console.log(ok(txt.includes('對話') && txt.includes('設定') && !txt.includes('Settings')), '初始為繁體中文（對話/設定）')
const lang0 = await evalJS(`return (await window.api.getConfig()).language`)
console.log(ok(lang0 === 'zh-TW'), `config.language = ${lang0}`)

// 2) 點右上語言 toggle
const clicked = await evalJS(`
  const b=[...document.querySelectorAll('button')].find(x=>(x.title||'').includes('語言')||(x.title||'').toLowerCase().includes('language'));
  if(b){ b.click(); return true } return false;
`)
console.log(ok(clicked), '找到並點擊語言切換鈕')
await sleep(500)

// 3) 全 UI 應變英文
txt = await bodyText()
console.log(ok(txt.includes('Chat') && txt.includes('Settings') && txt.includes('About')), '導覽列已切英文（Chat/Settings/About）')
console.log(ok(txt.includes('Data stays on this device')), 'LocalBadge 已切英文')
const lang1 = await evalJS(`return (await window.api.getConfig()).language`)
console.log(ok(lang1 === 'en'), `config.language 已持久化為 ${lang1}`)

// 4) 進「關於」確認作者英文名
await evalJS(`const b=[...document.querySelectorAll('button')].find(x=>x.title==='About'||x.innerText.trim()==='About'); if(b)b.click(); return !!b;`)
await sleep(400)
txt = await bodyText()
console.log(ok(txt.includes('YU-RU, PAN')), '關於頁作者英文名 YU-RU, PAN')
console.log(ok(txt.includes('National Taipei University')), '關於頁學校英文名')

// 5) 切回中文
await evalJS(`const b=[...document.querySelectorAll('button')].find(x=>(x.title||'').toLowerCase().includes('language')||(x.title||'').includes('語言')); if(b)b.click(); return !!b;`)
await sleep(400)
const lang2 = await evalJS(`return (await window.api.getConfig()).language`)
console.log(ok(lang2 === 'zh-TW'), `切回中文，config.language = ${lang2}`)

ws.close()
