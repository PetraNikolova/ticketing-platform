import { expect, type Locator, type Page } from '@playwright/test'

// Page Object for the login + Kanban board flow. Assertions live here (the spec
// composes steps), so this file owns the expect() calls.
export class BoardPage {
  constructor(private readonly page: Page) {}

  async login(email: string, password: string): Promise<void> {
    await this.page.goto('/login')
    await this.page.locator('#email').fill(email)
    await this.page.locator('#password').fill(password)
    await this.page.getByRole('button', { name: 'Log in' }).click()
    await expect(this.page).toHaveURL(/\/board/)
  }

  // Re-fetch teams (e.g. after creating one via the API) and select it.
  async reloadAndSelectTeam(teamId: string): Promise<void> {
    await this.page.goto('/board')
    await this.page.getByLabel('Team').selectOption(teamId)
  }

  column(state: string): Locator {
    return this.page.getByTestId(`column-${state}`)
  }

  card(title: string): Locator {
    return this.page.getByTestId('ticket-card').filter({ hasText: title })
  }

  async expectCardInColumn(title: string, state: string): Promise<void> {
    await expect(this.column(state).getByText(title)).toBeVisible()
  }

  async expectCardNotInColumn(title: string, state: string): Promise<void> {
    await expect(this.column(state).getByText(title)).toHaveCount(0)
  }

  // dnd-kit's PointerSensor needs the pointer to move past its activation
  // distance before the drag starts, so we step the mouse: press, nudge to
  // engage, glide to the target column, then release.
  async dragCardToColumn(title: string, state: string): Promise<void> {
    const card = this.card(title)
    const target = this.column(state)
    const from = await card.boundingBox()
    const to = await target.boundingBox()
    if (!from || !to) {
      throw new Error('Could not locate the card or the target column')
    }
    const startX = from.x + from.width / 2
    const startY = from.y + from.height / 2
    const endX = to.x + to.width / 2
    const endY = to.y + to.height / 2

    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down()
    await this.page.mouse.move(startX + 10, startY + 10, { steps: 5 })
    await this.page.mouse.move(endX, endY, { steps: 20 })
    await this.page.mouse.move(endX, endY + 8, { steps: 5 })
    await this.page.mouse.up()
  }
}
