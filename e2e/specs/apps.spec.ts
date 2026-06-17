import { test, expect } from '../fixtures/test'

const FORMS = [
  { tab: 'triage', field: 'apps-field-triage' },
  { tab: 'soap', field: 'apps-field-soap' },
  { tab: 'pharmacy', field: 'apps-field-pharmacy' },
  { tab: 'fhir', field: 'apps-field-fhir' }
] as const

test.describe('Apps load preset (offline)', () => {
  for (const f of FORMS) {
    test(`load sample fills the ${f.tab} form`, async ({ shell }) => {
      const page = shell.page
      await shell.goto('apps')
      await page.getByTestId(`apps-tab-${f.tab}`).click()
      await page.getByTestId('apps-load-sample').click()
      // loadPreset 是純前端（不需 LLM），代表欄位應被填入。
      await expect
        .poll(async () => (await page.getByTestId(f.field).inputValue()).trim().length)
        .toBeGreaterThan(0)
    })
  }
})
