import { expect, test, type Browser, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(process.cwd(), '..')
const artifactDir = path.join(rootDir, 'docs', 'playwright')
const screenshotDir = path.join(artifactDir, 'screenshots')
const videoDir = path.join(artifactDir, 'videos')
const rawVideoDir = path.join(videoDir, 'raw')

const navItems = [
  { href: '/upload', title: /上傳|Upload/i, slug: 'upload' },
  { href: '/', title: /Dashboard|總覽|儀表板/i, slug: 'dashboard' },
  { href: '/customers', title: /客戶|Customer/i, slug: 'customers' },
  { href: '/cohort', title: /Cohort|留存|同期/i, slug: 'cohort' },
  { href: '/basket', title: /Basket|購物籃|關聯/i, slug: 'basket' },
  { href: '/recommendations', title: /推薦|Recommendation/i, slug: 'recommendations' },
  { href: '/forecast', title: /Forecast|預測/i, slug: 'forecast' },
  { href: '/ml-insights', title: /ML|機器學習|洞察/i, slug: 'ml-insights' },
  { href: '/ab-testing', title: /A\/B|實驗/i, slug: 'ab-testing' },
  { href: '/tour', title: /RetailPulse BI|Tour|導覽|作品/i, slug: 'tour' },
]

function ensureArtifactDirs() {
  for (const dir of [
    path.join(screenshotDir, 'desktop'),
    path.join(screenshotDir, 'mobile'),
    videoDir,
    rawVideoDir,
  ]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.001s !important;
        animation-delay: 0s !important;
        transition-duration: 0.001s !important;
        scroll-behavior: auto !important;
      }
    `,
  }).catch(() => {})
}

async function waitForPageReady(page: Page) {
  await expect(page.locator('h1').first()).toBeVisible()
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(500)
  await dismissOverlays(page)
}

async function dismissOverlays(page: Page) {
  await page.keyboard.press('Escape').catch(() => {})
  const backdrop = page.locator('div.fixed.inset-0.bg-black\\/65')
  if (await backdrop.count()) {
    await backdrop.first().click({ force: true }).catch(() => {})
    await expect(backdrop).toHaveCount(0, { timeout: 5_000 }).catch(() => {})
  }
}

async function screenshotScrolled(page: Page, group: 'desktop' | 'mobile', slug: string) {
  const main = page.locator('main')
  await expect(main).toBeVisible()
  await main.evaluate((el) => { el.scrollTop = 0 })
  await page.waitForTimeout(150)

  const metrics = await main.evaluate((el) => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }))

  const step = Math.max(1, metrics.clientHeight - 80)
  const positions = metrics.scrollHeight <= metrics.clientHeight
    ? [0]
    : Array.from(
        new Set([
          0,
          ...Array.from({ length: Math.ceil((metrics.scrollHeight - metrics.clientHeight) / step) }, (_, i) => Math.min((i + 1) * step, metrics.scrollHeight - metrics.clientHeight)),
        ]),
      )

  for (let i = 0; i < positions.length; i++) {
    await main.evaluate((el, y) => { el.scrollTop = y }, positions[i])
    await page.waitForTimeout(200)
    await page.screenshot({
      path: path.join(screenshotDir, group, `${slug}-${String(i + 1).padStart(2, '0')}.png`),
      fullPage: false,
    })
  }
}

async function gotoAndAssert(page: Page, href: string, title: RegExp) {
  await page.goto(href)
  await page.waitForURL((url) => url.pathname === href)
  await waitForPageReady(page)
  await expect(page.locator('h1').first()).toContainText(title)
}

async function exerciseCommonControls(page: Page) {
  await expect(page.locator('aside button', { hasText: 'About this project' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^EN$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /中文|ZH|繁/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /功能導覽|tour/i })).toBeVisible()
}

async function exerciseUpload(page: Page) {
  await gotoAndAssert(page, '/upload', navItems[0].title)
  await page.getByRole('button', { name: /sample|示範|範例|使用/i }).last().click()
  await expect(page.getByText(/running|執行|資料|清理|建立/i).first()).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: path.join(screenshotDir, 'desktop', 'upload-running.png') })
}

async function exerciseCustomers(page: Page) {
  const customersResponse = page.waitForResponse(
    (res) => res.url().includes('/api/customers?') && res.status() === 200,
    { timeout: 45_000 },
  ).catch(() => null)
  await gotoAndAssert(page, '/customers', navItems[2].title)
  await customersResponse
  await page.waitForFunction(
    () => document.querySelectorAll('[data-tour="customer-list"] tbody tr').length > 0,
    null,
    { timeout: 45_000 },
  )
  const firstRow = page.locator('[data-tour="customer-list"] tbody tr').first()
  await expect(firstRow).toBeVisible()
  const firstCustomerId = (await firstRow.locator('td').first().innerText()).trim()

  await page.getByPlaceholder(/搜尋|Search|customer/i).fill(firstCustomerId)
  const filteredRow = page.locator('[data-tour="customer-list"] tbody tr', { hasText: firstCustomerId }).first()
  await expect(filteredRow).toBeVisible()
  await filteredRow.click()
  await expect(page.getByText(new RegExp(firstCustomerId)).first()).toBeVisible()
  await expect(page.getByText(/RFM/i).first()).toBeVisible()
  await page.getByRole('button', { name: /推薦|recommend/i }).click()
  await page.waitForURL(new RegExp(`/recommendations\\?customer=${firstCustomerId}`))
  await expect(page.locator('h1').first()).toContainText(navItems[5].title)
}

async function exerciseBasket(page: Page) {
  await gotoAndAssert(page, '/basket', navItems[4].title)
  await page.getByRole('slider').first().fill('2')
  await page.getByRole('textbox').first().fill('product')
  await expect(page.getByText(/showing|顯示|規則/i).first()).toBeVisible()
}

async function exerciseRecommendations(page: Page) {
  await gotoAndAssert(page, '/recommendations', navItems[5].title)
  const customerInput = page.getByPlaceholder(/customer|客戶/i)
  await customerInput.fill('C1004')
  await customerInput.press('Enter')
  await expect(page.getByText(/C1004|RFM|CLV/i).first()).toBeVisible()

  await page.getByRole('tab', { name: /product|商品/i }).click()
  const productInput = page.getByPlaceholder(/product|商品|stock/i)
  await productInput.fill('P001')
  await productInput.press('Enter')
  await expect(page.getByText(/P001|商品|recommend/i).first()).toBeVisible()

  await page.getByRole('tab', { name: /semantic|語意|NLP/i }).click()
  const semanticInput = page.getByPlaceholder(/search|搜尋|query|描述/i)
  await semanticInput.fill('gift')
  await semanticInput.press('Enter')
  await expect(page.getByText(/results|結果|similarity|相似/i).first()).toBeVisible()
}

async function exerciseForecast(page: Page) {
  await gotoAndAssert(page, '/forecast', navItems[6].title)
  await page.getByRole('button', { name: 'ETS' }).click()
  await page.getByRole('button', { name: '14d' }).click()
  await expect(page.getByText(/ETS|14 Days|14天/i).first()).toBeVisible()
}

async function exerciseMlInsights(page: Page) {
  await gotoAndAssert(page, '/ml-insights', navItems[7].title)
  await page.getByRole('tab', { name: /CLV|終身價值/i }).click()
  await expect(page.getByText(/CLV/i).first()).toBeVisible()
  await page.getByRole('tab', { name: /異常|Anomaly/i }).click()
  await expect(page.getByText(/異常|Anomaly/i).first()).toBeVisible()
  await page.getByRole('tab', { name: /模型比較|比較|Compare/i }).click()
  await expect(page.getByText(/模型|Model|AUC/i).first()).toBeVisible()
}

async function exerciseAbTesting(page: Page) {
  await gotoAndAssert(page, '/ab-testing', navItems[8].title)
  const demo = page.locator('[data-tour="demo-button"]')
  await demo.click()
  await expect(demo).toContainText(/建立中|running|200|Demo|示範/i, { timeout: 20_000 })
  await expect(demo).not.toContainText(/建立中|running/i, { timeout: 90_000 })
  await expect(page.locator('[data-tour="experiment-list"]')).toContainText(/Demo|Experiment|實驗/i)
  await page.getByRole('slider').first().fill('500')
}

async function exerciseTour(page: Page) {
  await gotoAndAssert(page, '/tour', navItems[9].title)
  await page.getByRole('link', { name: /Dashboard|儀表板|開始/i }).first().click().catch(() => {})
  await page.waitForLoadState('networkidle').catch(() => {})
}

async function runDesktopFlow(page: Page) {
  await page.goto('/')
  await stabilize(page)
  await waitForPageReady(page)
  await exerciseCommonControls(page)

  await exerciseCustomers(page)
  await exerciseBasket(page)
  await exerciseRecommendations(page)
  await exerciseForecast(page)
  await exerciseMlInsights(page)
  await exerciseAbTesting(page)
  await exerciseTour(page)

  for (const item of navItems) {
    await gotoAndAssert(page, item.href, item.title)
    await screenshotScrolled(page, 'desktop', item.slug)
  }

  await exerciseUpload(page)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  fs.rmSync(artifactDir, { recursive: true, force: true })
  ensureArtifactDirs()
})

test('desktop navigation, page functions, screenshots, and video', async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    recordVideo: { dir: rawVideoDir, size: { width: 1440, height: 950 } },
  })
  await context.addInitScript(() => {
    localStorage.setItem('retailpulse:disableAutoGuide', '1')
  })
  const page = await context.newPage()
  try {
    await runDesktopFlow(page)
  } finally {
    const video = page.video()
    await context.close()
    if (video) {
      const videoPath = await video.path()
      fs.copyFileSync(videoPath, path.join(videoDir, 'full-verification.webm'))
    }
  }
})

test('mobile navigation screenshots', async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  })
  await context.addInitScript(() => {
    localStorage.setItem('retailpulse:disableAutoGuide', '1')
  })
  const page = await context.newPage()
  await page.goto('/')
  await stabilize(page)
  await waitForPageReady(page)

  for (const item of navItems) {
    const link = page.locator(`a[href="${item.href}"]`).first()
    if (!(await link.isVisible())) {
      await page.getByRole('button', { name: /開啟選單|menu/i }).click({ force: true })
    }
    await link.evaluate((el: Element) => (el as HTMLElement).click())
    await page.waitForURL((url) => url.pathname === item.href)
    await waitForPageReady(page)
    await expect(page.locator('h1').first()).toContainText(item.title)
    await screenshotScrolled(page, 'mobile', item.slug)
  }

  await context.close()
})
