// Verify the isolated hero: shared light timeline, responsive layout and scroll parallax.
const assert = require("node:assert/strict")
const { chromium } = require("playwright")
const base = process.env.LIFY_PREVIEW_URL || "http://localhost:3000"
const sizes = [
  [320, 740],
  [375, 812],
  [390, 844],
  [430, 932],
  [600, 900],
  [768, 1024],
  [1024, 768],
  [1440, 700],
  [1440, 900],
  [1920, 1080],
  [844, 390],
]
;(async () => {
  const browser = await chromium.launch()
  const errors = []
  try {
    for (const [width, height] of sizes) {
      const p = await browser.newPage({ viewport: { width, height }, hasTouch: width < 768, isMobile: width < 768 })
      p.on("pageerror", (e) => errors.push(e.message))
      await p.goto(base, { waitUntil: "domcontentloaded" })
      await p.waitForFunction(() => document.querySelector(".vending-startup")?.dataset.startup === "running")
      // Pause the common image + headline timeline only for controlled intermediate inspection.
      await p.locator(".public-home").evaluate((n) => {
        n.getAnimations({ subtree: true })
          .filter((a) => /lify-(intro|startup|headline)/.test(a.animationName))
          .forEach((a) => {
            a.pause()
            a.currentTime = 100
          })
      })
      const early = await p.locator("h1 > span").evaluateAll((ns) => ns.map((n) => getComputedStyle(n).opacity))
      assert.deepEqual(early, ["0", "0", "0"])
      await p.locator(".public-home").evaluate((n) =>
        n
          .getAnimations({ subtree: true })
          .filter((a) => /lify-(intro|startup|headline)/.test(a.animationName))
          .forEach((a) => (a.currentTime = 1200)),
      )
      const middle = await p.locator("h1 > span").evaluateAll((ns) => ns.map((n) => getComputedStyle(n).opacity))
      assert.notEqual(middle[0], early[0])
      assert.notEqual(middle[1], early[1])
      assert.notEqual(middle[2], early[2])
      await p.locator(".public-home").evaluate((n) =>
        n
          .getAnimations({ subtree: true })
          .filter((a) => /lify-(intro|startup|headline)/.test(a.animationName))
          .forEach((a) => {
            a.currentTime = 2150
            a.play()
          }),
      )
      await p.waitForFunction(() => document.querySelector(".public-hero").dataset.startup === "complete")
      assert.equal(await p.locator("h1").innerText(), "Tu pausa.\nNuestra\nenergía.")
      assert.equal(
        await p
          .locator(
            ".world-disc,.world-orbit,.floating-product,.floating-note,.hero-stamp,.hero-product-sprite,.world-plus,.hero-motion-toggle",
          )
          .count(),
        0,
      )
      const layout = await p.evaluate(() => {
        const box = (s) => document.querySelector(s).getBoundingClientRect().toJSON()
        const title = document.querySelector("h1")
        const r = document.createRange()
        r.selectNodeContents(title)
        const image = box(".startup-camera")
        return {
          width: innerWidth,
          overflow: document.documentElement.scrollWidth - innerWidth,
          title: r.getBoundingClientRect().toJSON(),
          copy: box(".hero-copy"),
          image,
          footer: box(".hero-bottom"),
          hero: box(".public-hero"),
          machine: {
            left: image.left + (image.width * 173) / 1122,
            right: image.left + (image.width * 946) / 1122,
            top: image.top + (image.height * 78) / 1402,
            bottom: image.top + (image.height * 1310) / 1402,
          },
          background: getComputedStyle(document.querySelector(".public-hero")).backgroundColor,
        }
      })
      assert.equal(layout.overflow, 0)
      assert.equal(layout.background, "rgb(0, 0, 0)")
      assert.ok(layout.title.left >= 18 && layout.title.right <= width - 18)
      assert.ok(
        layout.machine.left >= 0 && layout.machine.right <= width && layout.machine.bottom <= layout.footer.top + 2,
      )
      if (width < 768) assert.ok(layout.copy.bottom <= layout.machine.top)
      else
        assert.ok(
          layout.copy.right <= layout.machine.left + 1,
          `Copy overlaps machine ${width}: ${JSON.stringify(layout)}`,
        )
      const before = await p.locator(".hero-machine").evaluate((n) => getComputedStyle(n).transform)
      await p.evaluate(() => scrollTo({ top: 160, behavior: "instant" }))
      await p.waitForTimeout(100)
      assert.notEqual(await p.locator(".hero-machine").evaluate((n) => getComputedStyle(n).transform), before)
      assert.ok(await p.locator(".public-nav").evaluate((n) => n.classList.contains("is-scrolled")))
      await p.setViewportSize({ width: width + 1, height })
      assert.equal(await p.locator(".vending-startup").getAttribute("data-startup"), "complete")
      if (width === 390) {
        await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" }))
        await p.getByRole("button", { name: "Abrir menú" }).click()
        assert.ok(await p.getByRole("dialog", { name: "Menú de navegación" }).isVisible())
        const colors = await p
          .getByRole("dialog")
          .evaluate((n) => ({ fg: getComputedStyle(n).color, bg: getComputedStyle(n).backgroundColor }))
        assert.deepEqual(colors, { fg: "rgb(238, 246, 243)", bg: "rgb(8, 15, 17)" })
        await p.getByRole("button", { name: "Cerrar menú" }).click()
      }
      console.log(`Shared headline lighting, clean hero, parallax and layout ${width}x${height}: OK`)
      await p.close()
    }
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
    await p.goto(base, { waitUntil: "domcontentloaded" })
    await p.waitForFunction(() => document.querySelector(".vending-startup")?.dataset.startup === "complete")
    assert.deepEqual(await p.locator("h1 > span").evaluateAll((ns) => ns.map((n) => getComputedStyle(n).opacity)), [
      "1",
      "1",
      "1",
    ])
    assert.equal(
      await p
        .locator(".public-hero")
        .evaluate(
          (n) =>
            n.getAnimations({ subtree: true }).filter((a) => /lify-(intro|startup|headline)/.test(a.animationName))
              .length,
        ),
      0,
    )
    await p.emulateMedia({ reducedMotion: "no-preference" })
    assert.equal(await p.locator(".vending-startup").getAttribute("data-startup"), "complete")
    assert.deepEqual(errors, [])
    console.log("Reduced motion, no restarts and runtime errors: OK")
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
