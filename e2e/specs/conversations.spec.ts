import { test, expect } from '../fixtures/test'

test.describe('Conversations (offline)', () => {
  test('seeded conversation can be renamed and deleted via UI', async ({ conversations }) => {
    const id = 'e2e-conv-1'
    await conversations.seed(id, 'E2E Seeded Title')
    await conversations.openChat()

    const item = conversations.item(id)
    await expect(item).toBeVisible()
    await expect(item).toContainText('E2E Seeded Title')

    await conversations.rename(id, 'E2E Renamed')
    await expect(item).toContainText('E2E Renamed')

    await conversations.remove(id)
    await expect(item).toHaveCount(0)
  })

  test('search box is present and accepts input', async ({ conversations }) => {
    await conversations.openChat()
    const search = conversations.search()
    await expect(search).toBeVisible()
    await search.fill('nothing-matches-xyz')
    await expect(search).toHaveValue('nothing-matches-xyz')
  })
})
