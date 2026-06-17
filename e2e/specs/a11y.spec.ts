import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '../fixtures/test'

const VIEWS = ['dashboard', 'chat', 'apps', 'tools', 'audit', 'settings', 'help', 'about'] as const

/**
 * 自動無障礙稽核：對每個 view 跑 axe-core（WCAG 2.0/2.1 A/AA），斷言無 serious/critical 違規。
 * 屬 offline project（不需 Ollama）→ CI 也會跑，能擋住 a11y 回歸。
 */
test.describe('Accessibility (offline)', () => {
  for (const view of VIEWS) {
    test(`${view} view has no serious/critical a11y violations`, async ({ shell }) => {
      await shell.goto(view)
      // 關掉 CSS transition/animation，避免 axe 在「色彩過場動畫途中」取到混色而誤判
      // （例如導覽列 active 標籤從前色漸變到品牌色的 150ms 過場）。量的是穩定態對比。
      await shell.page.addStyleTag({
        content: '*,*::before,*::after{transition:none!important;animation:none!important}'
      })
      const results = await new AxeBuilder({ page: shell.page })
        // Electron 不支援為跨來源 frame 開新分頁 → 用 legacy mode（單一 context 掃描，本 app 無 iframe）。
        .setLegacyMode(true)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      const severe = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      )
      const summary = severe.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target).slice(0, 3)
      }))
      expect(severe, JSON.stringify(summary, null, 2)).toEqual([])
    })
  }
})
