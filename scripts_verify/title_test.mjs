import { Ollama } from 'ollama'

const client = new Ollama({ host: 'http://localhost:11434' })

const cases = [
  [
    '各類別各有多少筆紀錄？最多的前三類是什麼？',
    '資料庫共有 15 個類別，總計 2,083,180 筆。前三大為 Nursing/other、Radiology、Nursing。'
  ],
  [
    '一位68歲男性胸痛冒冷汗 SpO2 89 血壓88/60，建議檢傷級別？',
    '綜合生命徵象與 TTAS，建議 TTAS 第 1 級（復甦），理由是 SBP<90 與 SpO2<90 雙危急。'
  ]
]

function clean(t) {
  t = (t || '').trim()
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  t = t.replace(/^["'「『]|["'」』]$/g, '').trim()
  t = t.split('\n').pop().trim() || t
  return t.slice(0, 24)
}

for (const [u, a] of cases) {
  const response = await client.chat({
    model: 'qwen3.6:27b',
    stream: true,
    messages: [
      {
        role: 'system',
        content:
          '你是標題產生器。根據對話內容，用繁體中文產生一個不超過 12 個字的簡短標題，直接只回標題本身，不要引號、不要標點結尾、不要任何解釋。'
      },
      { role: 'user', content: `使用者：${u}\n\n助理：${a}` }
    ]
  })
  let raw = ''
  for await (const part of response) raw += part.message?.content ?? ''
  console.log('原始輸出:', JSON.stringify(raw))
  console.log('→ 清理後標題:', clean(raw))
  console.log('---')
}
