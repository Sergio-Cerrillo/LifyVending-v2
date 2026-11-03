// One transparent master, one request, aligned layers and finite lighting.
const assert = require("node:assert/strict")
const sharp = require("sharp")
const { chromium, webkit } = require("playwright")
const base = process.env.LIFY_PREVIEW_URL || "http://localhost:3000"
;(async () => {
  const master = await sharp("public/images/startup/machine-isolated-v2.png").metadata()
  assert.ok(master.hasAlpha)
  const raw = await sharp("public/images/startup/machine-isolated-v2-1122.webp")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  assert.ok(raw.data[3] <= 2)
  assert.ok(raw.data.some((value, index) => index % 4 === 3 && value === 0))
  for (const [name, engine] of [
    ["Chromium", chromium],
    ["WebKit", webkit],
  ]) {
    const b = await engine.launch()
    const errors = []
    try {
      for (const [width, height] of [
        [320, 740],
        [390, 844],
        [768, 1024],
        [1440, 900],
        [1920, 1080],
      ]) {
        const p = await b.newPage({ viewport: { width, height }, hasTouch: width < 768, isMobile: width < 768 })
        p.on("pageerror", (e) => errors.push(e.message))
        await p.addInitScript(() => {
          window.heroCLS = 0
          try {
            new PerformanceObserver((l) => {
              for (const e of l.getEntries()) if (!e.hadRecentInput) window.heroCLS += e.value
            }).observe({ type: "layout-shift", buffered: true })
          } catch {}
        })
        await p.goto(base, { waitUntil: "domcontentloaded" })
        await p.addStyleTag({ content: "nextjs-portal{display:none}" })
        await p.waitForFunction(() => document.querySelector(".vending-startup")?.dataset.startup === "running")
        await p.locator(".public-home").evaluate((n) =>
          n
            .getAnimations({ subtree: true })
            .filter((a) => /lify-(intro|startup|headline)/.test(a.animationName))
            .forEach((a) => a.pause()),
        )
        for (const time of [100, 550, 1100, 1700, 2100]) {
          const sample = await p.locator(".public-home").evaluate((n, time) => {
            n.getAnimations({ subtree: true })
              .filter((a) => /lify-(intro|startup|headline)/.test(a.animationName))
              .forEach((a) => (a.currentTime = time))
            const image = n.querySelector(".startup-lit")
            return {
              lit: Number(getComputedStyle(image).opacity),
              edge: Number(getComputedStyle(n.querySelector(".startup-edge")).opacity),
              boxes: [...n.querySelectorAll(".vending-startup img")].map((i) => i.getBoundingClientRect().toJSON()),
              urls: [...n.querySelectorAll(".vending-startup img")].map((i) => i.currentSrc),
            }
          }, time)
          assert.equal(new Set(sample.urls).size, 1)
          for (const box of sample.boxes)
            for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(box[key] - sample.boxes[0][key]) < 0.1)
          if (time === 100) assert.equal(sample.lit, 0)
          if (time === 100) {
            const pixels = await sharp(await p.screenshot())
              .removeAlpha()
              .raw()
              .toBuffer()
            assert.ok(
              pixels.every((value) => value === 0),
              `${name} ${width}: first frame is not pure black`,
            )
          }
          if (time === 550) assert.ok(sample.edge > 0)
          if (time === 1100) assert.ok(sample.lit > 0 && sample.lit < 1)
          if (time === 2100) assert.equal(sample.lit, 1)
        }
        await p.locator(".public-home").evaluate((n) =>
          n
            .getAnimations({ subtree: true })
            .filter((a) => /lify-(intro|startup|headline)/.test(a.animationName))
            .forEach((a) => {
              a.currentTime = 2150
              a.play()
            }),
        )
        await p.waitForFunction(() => document.querySelector(".vending-startup").dataset.startup === "complete")
        assert.equal(await p.locator(".startup-base").count(), 0)
        assert.equal(await p.locator(".startup-edge").evaluate((n) => getComputedStyle(n).display), "none")
        assert.ok(
          await p.locator(".public-home").evaluate((n) =>
            n
              .getAnimations({ subtree: true })
              .filter((a) => /lify-(intro|startup|headline)/.test(a.animationName))
              .every((a) => a.playState === "finished"),
          ),
        )
        const metrics = await p.evaluate(() => ({
          cls: window.heroCLS,
          requests: performance
            .getEntriesByType("resource")
            .filter((e) => e.name.includes("/images/startup/"))
            .map((e) => ({ url: e.name, bytes: e.encodedBodySize })),
          old: performance.getEntriesByType("resource").filter((e) => e.name.includes("lify_encendido_web/")).length,
        }))
        assert.equal(metrics.requests.length, 1)
        assert.equal(metrics.old, 0)
        assert.ok(metrics.cls < 0.01)
        await p.screenshot({ path: `/tmp/lify-isolated-${name}-${width}.png` })
        console.log(
          `${name} ${width}x${height}: aligned transparent layers, final state, 1 image request, CLS ${metrics.cls}: OK`,
        )
        await p.close()
      }
      const nojs = await b.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false })
      await nojs.goto(base, { waitUntil: "domcontentloaded" })
      assert.equal(await nojs.locator(".startup-lit").evaluate((n) => getComputedStyle(n).opacity), "1")
      assert.equal(await nojs.locator(".hero-green").evaluate((n) => getComputedStyle(n).color), "rgb(19, 223, 188)")
      assert.ok(await nojs.locator(".hero-copy .public-button").isVisible())
      assert.equal(await nojs.locator(".public-nav").evaluate((n) => getComputedStyle(n).opacity), "1")
      for (const action of ["keyboard", "scroll", "pointer", "reduced"]) {
        const page = await b.newPage({ viewport: { width: 390, height: 844 } })
        await page.goto(base, { waitUntil: "domcontentloaded" })
        await page.waitForFunction(() => document.querySelector(".public-home").dataset.intro === "running")
        if (action === "keyboard") await page.keyboard.press("Tab")
        if (action === "scroll") await page.evaluate(() => scrollTo({ top: 180, behavior: "instant" }))
        if (action === "pointer") await page.mouse.click(10, 100)
        if (action === "reduced") await page.emulateMedia({ reducedMotion: "reduce" })
        await page.waitForFunction(() => document.querySelector(".public-home").dataset.intro === "complete")
        assert.equal(await page.locator(".public-nav").evaluate((n) => getComputedStyle(n).opacity), "1")
        assert.equal(await page.locator(".startup-lit").evaluate((n) => getComputedStyle(n).opacity), "1")
        await page.close()
      }
      const fallback = await b.newPage({ viewport: { width: 390, height: 844 } })
      await fallback.route("**/_next/static/**/*.js", (route) => route.abort())
      await fallback.goto(base, { waitUntil: "domcontentloaded" })
      await fallback.waitForFunction(() => getComputedStyle(document.querySelector(".public-nav")).opacity === "1")
      assert.equal(await fallback.locator(".startup-lit").evaluate((n) => getComputedStyle(n).opacity), "1")
      await fallback.close()
      assert.deepEqual(errors, [])
      console.log(`${name} no-JS fallback and runtime errors: OK`)
    } finally {
      await b.close()
    }
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
