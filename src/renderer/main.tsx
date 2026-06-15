import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initI18n } from './i18n'
import { applyTheme } from './lib/theme'
import './index.css'

// 先取設定中的語言與主題、完成 i18n 初始化，再渲染 → 首屏即正確語言與主題，無閃爍。
async function bootstrap(): Promise<void> {
  let language: string | undefined
  try {
    const cfg = await window.api.getConfig()
    language = cfg?.language
    applyTheme(cfg?.theme ?? 'system')
  } catch {
    /* 取設定失敗就用預設語言與主題 */
    applyTheme('system')
  }
  await initI18n(language)

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

void bootstrap()
