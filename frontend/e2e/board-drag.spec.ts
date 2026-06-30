import { test, expect } from '@playwright/test'
import { BoardPage } from './pages/board.page'

// The headline DoD flow: log in → board → drag a ticket to a new state column →
// the change is persisted on the server and survives a full page reload.
const DEMO = { email: 'demo@example.com', password: 'sup3rsecret!' }

test('dragging a ticket to a new column persists after reload', async ({
  page,
}) => {
  const board = new BoardPage(page)
  const stamp = Date.now()
  const ticketTitle = `E2E drag ${stamp}`
  let teamId = ''

  await test.step('log in as the verified demo user', async () => {
    await board.login(DEMO.email, DEMO.password)
  })

  await test.step('seed a team + a New ticket via the API (reusing the session cookie)', async () => {
    const teamRes = await page.request.post('/api/teams', {
      data: { name: `E2E Team ${stamp}` },
    })
    expect(teamRes.ok(), `team create returned ${teamRes.status()}`).toBeTruthy()
    teamId = (await teamRes.json()).id

    const ticketRes = await page.request.post('/api/tickets', {
      data: {
        teamId,
        type: 'bug',
        title: ticketTitle,
        body: 'Created by the e2e drag test.',
      },
    })
    expect(ticketRes.ok(), `ticket create returned ${ticketRes.status()}`).toBeTruthy()
  })

  await test.step('open the board for that team — the card starts in New', async () => {
    await board.reloadAndSelectTeam(teamId)
    await board.expectCardInColumn(ticketTitle, 'new')
  })

  await test.step('drag the card to Ready for Implementation', async () => {
    // The board updates optimistically, so wait for the PATCH /state response to
    // confirm the server actually persisted the move before we reload.
    const [stateResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/api\/tickets\/[^/]+\/state$/.test(r.url()) &&
          r.request().method() === 'PATCH',
      ),
      board.dragCardToColumn(ticketTitle, 'ready_for_implementation'),
    ])
    expect(stateResponse.ok()).toBeTruthy()
    await board.expectCardInColumn(ticketTitle, 'ready_for_implementation')
  })

  await test.step('reload — the server is the source of truth, so it stays moved', async () => {
    await page.reload()
    await board.expectCardInColumn(ticketTitle, 'ready_for_implementation')
    await board.expectCardNotInColumn(ticketTitle, 'new')
  })
})
