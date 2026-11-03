// Run against a running preview: node scripts/check-public-experiences.cjs
// LIFY_PREVIEW_URL can point to a production preview instead of localhost.
const assert = require("node:assert/strict")
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

async function open(page, route) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" })
  assert.equal(response.status(), 200)
  await page.locator(".interactive-vending, .technical-exploded").first().waitFor()
}

async function scrollChapter(page, locator, index, count) {
  await locator.evaluate(
    (node, { index, count }) => {
      const box = node.getBoundingClientRect()
      window.scrollTo({
        top: window.scrollY + box.top + ((index + 0.35) / count) * (box.height - window.innerHeight),
        behavior: "instant",
      })
    },
    { index, count },
  )
  await page.waitForTimeout(100)
}

async function checkLayout(page, scene, selectors, height) {
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))
  assert.ok(sizes.content <= sizes.viewport, `Horizontal overflow: ${JSON.stringify(sizes)}`)
  if (await scene.evaluate((node) => node.classList.contains("is-scroll-driven"))) {
    const boxes = await scene.locator(selectors).evaluateAll((nodes) =>
      nodes.map((node) => ({
        name: node.className,
        top: node.getBoundingClientRect().top,
        bottom: node.getBoundingClientRect().bottom,
      })),
    )
    for (const box of boxes)
      assert.ok(
        box.top >= 65 && box.bottom <= height - 2,
        `Scene clipped at ${sizes.viewport}x${height}: ${JSON.stringify(box)}`,
      )
  }
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const errors = []
  try {
    for (const [width, height] of sizes) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 768 })
      page.on("pageerror", (error) => errors.push(error.message))
      await open(page, "/")
      await page.locator(".motion-ready").waitFor()
      // Real selection, delivery, quick reselection and keyboard interaction.
      if (width === 390 || (width === 1440 && height === 900)) {
        for (const name of ["café", "agua", "snacks"]) {
          await page.getByRole("button", { name: `Elegir ${name}`, exact: true }).click()
          await page.waitForFunction(() => document.querySelector(".vending-playground").dataset.phase === "ready")
          assert.match(await page.locator(".demo-live-status").innerText(), new RegExp(name))
          assert.equal(await page.locator(".demo-delivery .demo-delivered-product").count(), 1)
        }
        await page.getByRole("button", { name: "Elegir café", exact: true }).click()
        await page.getByRole("button", { name: "Elegir snacks", exact: true }).click()
        await page.waitForFunction(() => document.querySelector(".vending-playground").dataset.phase === "ready")
        assert.match(await page.locator(".demo-live-status").innerText(), /snacks/)
        await page.getByRole("button", { name: "Elegir agua", exact: true }).focus()
        await page.keyboard.press("Enter")
        await page.waitForFunction(() => document.querySelector(".vending-playground").dataset.phase === "ready")
        assert.match(await page.locator(".demo-live-status").innerText(), /agua/)
      }
      const environment = page.locator("#espacios")
      for (const [index, id] of ["sport", "office", "hotel"].entries()) {
        if (await environment.evaluate((node) => node.classList.contains("is-scroll-driven")))
          await scrollChapter(page, environment, index, 3)
        else await environment.locator(".environment-choices button").nth(index).click()
        await page.waitForFunction((id) => document.getElementById("espacios").dataset.environment === id, id)
        await page.waitForFunction(() => {
          const picture = document.querySelector(".environment-photo.is-active")
          const photo = picture.querySelector("img")
          return photo.complete && photo.naturalWidth > 0 && Number(getComputedStyle(picture).opacity) > 0.98
        })
        const imageName = ["gimnasio", "oficina", "hotel"][index]
        assert.match(
          await environment.locator(".environment-photo.is-active img").evaluate((node) => node.currentSrc),
          new RegExp(`${imageName}-${width < 768 ? 960 : 1680}\\.webp`),
        )
        assert.equal(await environment.locator('.environment-photo[aria-hidden="false"]').count(), 1)
        await checkLayout(
          page,
          environment,
          ".environment-heading,.environment-room,.environment-copy,.environment-bottom",
          height,
        )
      }
      if (width === 390) {
        await environment.getByRole("button", { name: "Deporte", exact: true }).click()
        await page.waitForFunction(() => document.getElementById("espacios").dataset.environment === "sport")
        await environment.getByRole("button", { name: "Hotel", exact: true }).click()
        await page.waitForFunction(() => document.getElementById("espacios").dataset.environment === "hotel")
      }
      await open(page, "/servicio-tecnico")
      await page.locator(".motion-ready").waitFor()
      await page.waitForFunction(() => {
        const photo = document.querySelector(".technical-hero-media img")
        return photo.complete && photo.naturalWidth > 0
      })
      assert.match(
        await page.locator(".technical-hero-media img").evaluate((node) => node.currentSrc),
        new RegExp(`servicio-tecnico-${width < 768 ? "mobile" : 1680}\\.webp`),
      )
      const technical = page.locator("#por-dentro")
      const technicalParts = ["diagnosis", "mechanisms", "maintenance", "repair", "access", "structure"]
      await page.waitForFunction(() => {
        const layers = Array.from(document.querySelectorAll(".exploded-photo-layer img"))
        return layers.length === 6 && layers.every((layer) => layer.complete && layer.naturalWidth > 0)
      })
      for (const [index, id] of technicalParts.entries()) {
        if (await technical.evaluate((node) => node.classList.contains("is-scroll-driven")))
          await scrollChapter(page, technical, index, technicalParts.length)
        else await technical.locator(".technical-part-controls button").nth(index).click()
        await page.waitForFunction((id) => document.querySelector(".exploded-stage").dataset.part === id, id)
        assert.equal(await technical.locator('.exploded-photo-layer[data-selected="true"]').count(), 1)
        await checkLayout(page, technical, ".exploded-heading,.exploded-visual,.exploded-copy,.exploded-bottom", height)
      }
      if (width === 390) {
        await page.getByRole("button", { name: "Explorar diagnóstico", exact: true }).tap()
        await page.waitForFunction(() => document.querySelector(".exploded-stage").dataset.part === "diagnosis")
        await page.getByRole("button", { name: "Explorar refrigeración", exact: true }).focus()
        await page.keyboard.press("Enter")
        await page.waitForFunction(() => document.querySelector(".exploded-stage").dataset.part === "maintenance")
      }
      await page.getByRole("button", { name: "Ver máquina montada", exact: true }).click()
      await page.getByRole("button", { name: "Ver despiece", exact: true }).waitFor()
      await page.waitForFunction(
        () => Number(document.querySelector(".exploded-stage").style.getPropertyValue("--open")) === 0,
      )
      const layer = page.locator(".part-door")
      const assembled = await layer.evaluate((node) => getComputedStyle(node).transform)
      await page.getByRole("button", { name: "Ver despiece", exact: true }).click()
      await page.waitForFunction(
        () => Number(document.querySelector(".exploded-stage").style.getPropertyValue("--open")) === 1,
      )
      assert.notEqual(await layer.evaluate((node) => getComputedStyle(node).transform), assembled)
      if (width === 390) {
        await page.getByRole("button", { name: "Volver a la exploración con scroll", exact: true }).click()
        assert.equal(await technical.locator(".exploded-stage").getAttribute("data-manual"), "false")
        await scrollChapter(page, technical, 0, technicalParts.length)
        await page.waitForFunction(
          () => Number(document.querySelector(".exploded-stage").style.getPropertyValue("--open")) < 0.1,
        )
        const start = await layer.evaluate((node) => getComputedStyle(node).transform)
        await scrollChapter(page, technical, 5, technicalParts.length)
        assert.notEqual(await layer.evaluate((node) => getComputedStyle(node).transform), start)
      }
      console.log(`Experiences, interactions and layout ${width}x${height}: OK`)
      await page.close()
    }
    const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
    reduced.on("pageerror", (error) => errors.push(error.message))
    await open(reduced, "/")
    await reduced.getByRole("button", { name: "Elegir café", exact: true }).click()
    assert.equal(await reduced.locator(".vending-playground").getAttribute("data-phase"), "ready")
    assert.equal(await reduced.locator(".is-scroll-driven").count(), 0)
    await reduced.locator(".environment-choices").getByRole("button", { name: "Hotel", exact: true }).click()
    assert.equal(await reduced.locator("#espacios").getAttribute("data-environment"), "hotel")
    assert.equal(
      await reduced.locator(".environment-photo.is-active img").evaluate((node) => getComputedStyle(node).transform),
      "none",
    )
    await open(reduced, "/servicio-tecnico")
    await reduced.getByRole("button", { name: "Explorar selección y pago", exact: true }).click()
    assert.equal(await reduced.locator(".exploded-stage").getAttribute("data-part"), "repair")
    assert.equal(await reduced.locator(".is-scroll-driven").count(), 0)
    await reduced.getByRole("link", { name: "Hablemos de tu máquina", exact: true }).click()
    await reduced.waitForFunction(
      () => Math.abs(document.getElementById("asistencia").getBoundingClientRect().top - 90) < 12,
    )
    console.log("Reduced motion, manual controls and assistance link: OK")
    const direct = await browser.newPage({ viewport: { width: 390, height: 844 } })
    for (const [route, id] of [
      ["/#contacto", "contacto"],
      ["/servicio-tecnico#asistencia", "asistencia"],
    ]) {
      await open(direct, route)
      await direct.waitForFunction(
        (id) => Math.abs(document.getElementById(id).getBoundingClientRect().top - 90) < 12,
        id,
      )
    }
    console.log("Direct contact links after scene enhancement: OK")
    assert.deepEqual(errors, [])
    console.log("Browser runtime errors: 0")
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
