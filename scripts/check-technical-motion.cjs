// Run against a preview; LIFY_PREVIEW_URL optionally selects a production server.
const assert = require("node:assert/strict")
const sharp = require("sharp")
const { chromium } = require("playwright")
const baseUrl = process.env.LIFY_PREVIEW_URL || "http://localhost:3000"
const sizes = [
  [320, 740],
  [375, 812],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 700],
  [1440, 900],
  [1920, 1080],
  [844, 390],
]

async function opaqueBounds(file) {
  const { data, info } = await sharp(`public/images/technical/${file}.webp`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let left = info.width,
    top = info.height,
    right = 0,
    bottom = 0
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 20) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
  return { left: left / info.width, right: right / info.width, top: top / info.height, bottom: bottom / info.height }
}

async function settled(page, value) {
  await page.waitForFunction((value) => {
    const stage = document.querySelector(".exploded-stage")
    return (
      Math.abs(Number(stage.style.getPropertyValue("--open")) - value) < 0.00001 && stage.dataset.moving === "false"
    )
  }, value)
}

async function scrollTo(page, fraction) {
  await page.locator("#por-dentro").evaluate((node, fraction) => {
    window.scrollTo({
      top: scrollY + node.getBoundingClientRect().top + fraction * (node.offsetHeight - innerHeight),
      behavior: "instant",
    })
  }, fraction)
  await page.waitForTimeout(60)
}

async function startSampling(page) {
  await page.evaluate(() => {
    window.technicalSamples = []
    window.sampleTechnicalMotion = true
    const record = (time) => {
      window.technicalSamples.push({
        time,
        value: Number(document.querySelector(".exploded-stage").style.getPropertyValue("--open")),
      })
      if (window.sampleTechnicalMotion) requestAnimationFrame(record)
    }
    requestAnimationFrame(record)
  })
}

async function samples(page) {
  return page.evaluate(() => {
    window.sampleTechnicalMotion = false
    return window.technicalSamples
  })
}

;(async () => {
  const bounds = {}
  for (const file of ["01-carcasa", "02-puerta", "03-bandejas", "04-pago", "05-frio", "06-electronica"])
    bounds[file] = await opaqueBounds(file)
  const browser = await chromium.launch({ headless: true })
  const errors = []
  try {
    for (const [width, height] of sizes) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 768 })
      page.on("pageerror", (error) => errors.push(error.message))
      assert.equal((await page.goto(`${baseUrl}/servicio-tecnico`, { waitUntil: "domcontentloaded" })).status(), 200)
      await page.locator(".motion-ready").waitFor()
      const scene = page.locator("#por-dentro")
      const pinned = await scene.evaluate((node) => node.classList.contains("is-scroll-driven"))
      if (pinned) await scrollTo(page, 0.45)
      else await scene.scrollIntoViewIfNeeded()
      await page.getByRole("button", { name: "Ver máquina montada", exact: true }).click()
      await settled(page, 0)
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".exploded-photo-layer img")].every(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      )
      // Inspect the painted portions of the PNGs, rather than their mostly empty canvases.
      const painted = await page.evaluate(
        (bounds) =>
          Object.fromEntries(
            [...document.querySelectorAll(".exploded-photo-layer")].map((layer) => {
              const file = layer.querySelector("img").getAttribute("src").split("/").pop().replace(".webp", "")
              const rect = layer.querySelector(".exploded-registration").getBoundingClientRect()
              const alpha = bounds[file]
              return [
                file,
                {
                  left: rect.left + alpha.left * rect.width,
                  right: rect.left + alpha.right * rect.width,
                  top: rect.top + alpha.top * rect.height,
                  bottom: rect.top + alpha.bottom * rect.height,
                },
              ]
            }),
          ),
        bounds,
      )
      const shell = painted["01-carcasa"]
      const door = painted["02-puerta"]
      for (const [file, part] of Object.entries(painted)) {
        assert.ok(part.bottom <= shell.bottom + 2, `${width}: ${file} protrudes below the cabinet`)
        assert.ok(
          part.top >= shell.top - 2 && part.left >= shell.left - 2 && part.right <= shell.right + 2,
          `${width}: ${file} does not fit inside the cabinet`,
        )
      }
      assert.ok((door.right - door.left) / (shell.right - shell.left) > 0.58, "Door does not span the front opening")
      assert.ok((door.bottom - door.top) / (shell.bottom - shell.top) > 0.74, "Door is too short for the front opening")
      assert.match(
        await page.locator(".part-door img").evaluate((node) => getComputedStyle(node).maskImage),
        /technical-door-glass/,
      )
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      assert.equal(await scene.locator(".exploded-stage button").count(), 0, "Controls obscure the machine")
      assert.equal(await scene.locator(".technical-part-controls button").count(), 6)
      for (const label of await scene.locator(".technical-part-controls button").allTextContents()) {
        assert.doesNotMatch(label.trim(), /^\d/, "Component names still have numbered badges")
      }
      const points = await scene.locator(".technical-part-controls button").evaluateAll((nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect()
          return { x: r.x, y: r.y, width: r.width, height: r.height }
        }),
      )
      for (const [index, point] of points.entries())
        for (const other of points.slice(index + 1)) {
          assert.ok(
            point.x + point.width <= other.x ||
              other.x + other.width <= point.x ||
              point.y + point.height <= other.y ||
              other.y + other.height <= point.y,
            "Touch targets overlap",
          )
        }
      if (pinned) {
        const boxes = await scene
          .locator(".exploded-heading,.exploded-visual,.exploded-copy,.exploded-bottom")
          .evaluateAll((nodes) =>
            nodes.map((node) => ({
              name: node.className,
              top: node.getBoundingClientRect().top,
              bottom: node.getBoundingClientRect().bottom,
            })),
          )
        for (const box of boxes)
          assert.ok(box.top >= 65 && box.bottom <= height - 2, `${width}x${height}: ${JSON.stringify(box)}`)
      }
      if (width === 390 || (width === 1440 && height === 900)) {
        await startSampling(page)
        await page.getByRole("button", { name: "Ver despiece", exact: true }).click()
        await settled(page, 1)
        const opening = await samples(page)
        assert.ok(
          opening.filter((sample) => sample.value > 0.02 && sample.value < 0.98).length >= 12,
          "Opening skips intermediate frames",
        )
        for (let index = 1; index < opening.length; index++) {
          const delta = opening[index].value - opening[index - 1].value
          assert.ok(delta >= -0.00001 && delta < 0.3, `Discontinuous opening: ${delta}`)
        }
        await page.getByRole("button", { name: "Ver máquina montada", exact: true }).click()
        await page.waitForFunction(
          () => Number(document.querySelector(".exploded-stage").style.getPropertyValue("--open")) < 0.7,
        )
        const before = await page
          .locator(".exploded-stage")
          .evaluate((node) => Number(node.style.getPropertyValue("--open")))
        await page.getByRole("button", { name: "Ver despiece", exact: true }).click()
        const after = await page
          .locator(".exploded-stage")
          .evaluate((node) => Number(node.style.getPropertyValue("--open")))
        assert.ok(Math.abs(after - before) < 0.25, "Reversing direction snaps the playhead")
        await settled(page, 1)
        await scrollTo(page, 0.97)
        await page.getByRole("button", { name: "Ver máquina montada", exact: true }).click()
        await settled(page, 0)
        await page.getByRole("button", { name: "Volver a la exploración con scroll", exact: true }).click()
        const resumed = await page
          .locator(".exploded-stage")
          .evaluate((node) => Number(node.style.getPropertyValue("--open")))
        assert.ok(resumed < 0.3, "Returning to scroll snaps directly to the scroll position")
        await settled(page, 1)
        await scrollTo(page, 0)
        await settled(page, 0)
        await scrollTo(page, 0.97)
        const following = await page
          .locator(".exploded-stage")
          .evaluate((node) => Number(node.style.getPropertyValue("--open")))
        assert.ok(following > 0 && following < 0.9, "Scroll jumps directly to the final pose")
        await settled(page, 1)
        await page.emulateMedia({ reducedMotion: "reduce" })
        await page.getByRole("button", { name: "Ver máquina montada", exact: true }).click()
        await settled(page, 0)
        await page.getByRole("button", { name: "Explorar selección y pago", exact: true }).click()
        await settled(page, 1)
        assert.equal(await scene.locator(".exploded-stage").getAttribute("data-part"), "repair")
        assert.equal(
          await scene.locator(".part-door").evaluate((node) => getComputedStyle(node).transitionDuration),
          "0s",
        )
        console.log(`Continuous motion, reversal, scroll handoff and reduced motion ${width}: OK`)
      }
      console.log(`Mounting geometry, glass, touch targets and layout ${width}x${height}: OK`)
      await page.close()
    }
    assert.deepEqual(errors, [])
    console.log("Browser runtime errors: 0")
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
