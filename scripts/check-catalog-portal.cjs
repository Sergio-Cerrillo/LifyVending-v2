const assert = require("node:assert/strict")
const { chromium } = require("playwright")
const base = process.env.LIFY_PREVIEW_URL || "http://localhost:3000"
const sizes = [
  [320, 740],
  [375, 812],
  [390, 844],
  [390, 700],
  [390, 640],
  [768, 1024],
  [1024, 768],
  [1440, 700],
  [1440, 900],
  [1920, 1080],
  [844, 390],
]
async function progress(page, p) {
  await page.locator(".catalog-portal").evaluate(
    (n, p) =>
      scrollTo({
        top:
          scrollY +
          n.getBoundingClientRect().top +
          p * (n.offsetHeight - n.querySelector(".catalog-portal-viewport").offsetHeight),
        behavior: "instant",
      }),
    p,
  )
  await page.waitForFunction((p) => {
    const n = document.querySelector(".catalog-portal")
    const actual = Math.max(
      0,
      Math.min(
        1,
        -n.getBoundingClientRect().top / (n.offsetHeight - n.querySelector(".catalog-portal-viewport").offsetHeight),
      ),
    )
    return (
      Math.abs(Number(n.dataset.portalProgress) - actual) < 0.0001 &&
      Math.abs(actual - p) < 0.003 &&
      n.dataset.portalMoving === "false"
    )
  }, p)
}
;(async () => {
  const browser = await chromium.launch({ headless: true })
  const errors = []
  try {
    for (const [width, height] of sizes) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 768 })
      page.on("pageerror", (e) => errors.push(e.message))
      await page.goto(`${base}/catalogo`, { waitUntil: "domcontentloaded" })
      await page.waitForFunction(() => document.querySelector(".catalog-portal")?.dataset.portalProgress !== undefined)
      const active = await page.locator(".catalog-portal").evaluate((n) => n.classList.contains("is-portal-active"))
      assert.equal(active, height >= (width < 768 ? 700 : 640))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      assert.equal(await page.locator(".catalog-portal-world").evaluate((n) => n.inert), true)
      const layout = await page.evaluate(() => {
        const q = (s) => document.querySelector(s).getBoundingClientRect().toJSON()
        return { copy: q(".catalog-entry-copy"), machine: q(".catalog-machine"), footer: q(".catalog-portal-footer") }
      })
      if (width < 768)
        assert.ok(
          layout.copy.bottom <= layout.machine.top + 5,
          `Intro overlap ${width}x${height}: ${JSON.stringify(layout)}`,
        )
      assert.ok(layout.machine.bottom <= layout.footer.top + 8, `Machine/footer overlap ${width}x${height}`)
      if (active) {
        await progress(page, 0.45)
        assert.equal(await page.locator(".catalog-portal-world").evaluate((n) => n.inert), true)
        await progress(page, 0.98)
        assert.equal(await page.locator(".catalog-portal-world").evaluate((n) => n.inert), false)
        const boxes = await page
          .locator(".catalog-world-heading, .catalog-world-card, .catalog-world-bottom")
          .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()))
        for (const box of boxes)
          assert.ok(
            box.top >= 90 && box.bottom <= height - 70 && box.left >= 15 && box.right <= width - 15,
            `Clipped content ${width}x${height}: ${JSON.stringify(box)}`,
          )
        const glass = await page.locator(".catalog-machine-window").boundingBox()
        assert.ok(glass.x <= 0 && glass.y <= 0 && glass.x + glass.width >= width && glass.y + glass.height >= height)
        if ((width === 390 && height === 844) || (width === 1440 && height === 900)) {
          for (const id of ["snacks", "bebidas-frias", "bebidas-calientes", "varios"]) {
            await progress(page, 0.98)
            await page.locator(`.catalog-portal-world a[href="#${id}"]`).click()
            await page.waitForFunction(
              (id) =>
                location.hash === `#${id}` &&
                document.getElementById(id).open &&
                Math.abs(document.getElementById(id).getBoundingClientRect().top - 100) < 3,
              id,
            )
            assert.equal(await page.evaluate(() => document.activeElement.tagName), "SUMMARY")
          }
          await progress(page, 0)
          await page.locator(".catalog-enter-cue").focus()
          await page.keyboard.press("Enter")
          await page.waitForFunction(() => document.querySelector(".catalog-portal").dataset.portalPhase === "inside")
          assert.ok(
            await page
              .locator(".catalog-world-card")
              .first()
              .evaluate((n) => document.activeElement === n),
          )
          await page.emulateMedia({ reducedMotion: "reduce" })
          await page.waitForFunction(
            () => !document.querySelector(".catalog-portal").classList.contains("is-portal-active"),
          )
          assert.equal(
            await page.locator(".catalog-portal").evaluate((n) => n.classList.contains("is-portal-active")),
            false,
          )
          assert.ok(
            Math.abs((await page.locator("#productos").evaluate((n) => n.getBoundingClientRect().top)) - 90) < 3,
          )
        }
      }
      await page.goto(`${base}/catalogo`, { waitUntil: "domcontentloaded" })
      await page.locator(".catalog-direct-link").click()
      await page.waitForFunction(
        () =>
          location.hash === "#productos" &&
          Math.abs(document.getElementById("productos").getBoundingClientRect().top - 90) < 3,
      )
      console.log(`Catalog scroll portal, category fit and bypass ${width}x${height}: OK`)
      await page.close()
    }
    const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
    await reduced.goto(`${base}/catalogo#bebidas-calientes`, { waitUntil: "domcontentloaded" })
    await reduced.waitForFunction(() => document.getElementById("bebidas-calientes").open)
    assert.equal(
      await reduced.locator(".catalog-portal").evaluate((n) => n.classList.contains("is-portal-active")),
      false,
    )
    assert.equal(await reduced.locator(".catalog-portal-world").evaluate((n) => n.inert), true)
    assert.deepEqual(errors, [])
    console.log("Catalog reduced motion, direct category links and runtime errors: OK")
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
