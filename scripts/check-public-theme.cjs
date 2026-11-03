const assert = require("node:assert/strict")
const { chromium, webkit } = require("playwright")
const base = process.env.LIFY_PREVIEW_URL || "http://localhost:3000"
const routes = {
  "/": [
    ".experience-heading > p",
    ".demo-story-copy > p",
    ".demo-repeat",
    ".demo-product-controls button",
    ".zero-copy p",
    ".process-step p",
    ".contact-bottom p",
    ".public-button",
    ".footer-bottom",
    ".studio-credit",
  ],
  "/sobre-nosotros": [
    ".about-story-copy p",
    ".values-grid p",
    ".faq-list details > p",
    ".about-final h2 span",
    ".public-button",
    ".footer-bottom",
  ],
  "/catalogo": [
    ".catalog-entry-copy p",
    ".catalog-direct-link",
    ".category-description p",
    ".catalog-custom p",
    ".category-index",
    ".public-button",
    ".footer-bottom",
  ],
  "/servicio-tecnico": [
    ".technical-part-controls button",
    ".exploded-detail p",
    ".exploded-view-controls button",
    ".values-grid p",
    ".faq-list details > p",
    ".technical-assistance p",
    ".public-button",
    ".footer-bottom",
  ],
}
;(async () => {
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
      ])
        for (const [route, selectors] of Object.entries(routes)) {
          const p = await b.newPage({ viewport: { width, height }, hasTouch: width < 768, reducedMotion: "reduce" })
          p.on("pageerror", (e) => errors.push(e.message))
          await p.goto(base + route, { waitUntil: "domcontentloaded" })
          await p.locator("main.public-site").waitFor()
          await p.locator(".public-footer").waitFor()
          if (route === "/catalogo")
            await p.waitForFunction(
              () => document.querySelector(".catalog-portal").dataset.portalProgress !== undefined,
            )
          if (route === "/")
            await p.waitForFunction(() => document.querySelector(".public-home").dataset.intro === "complete")
          const metrics = await p.evaluate((selectors) => {
            const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number)
            const blend = (fg, bg) => {
              const a = fg[3] ?? 1
              return fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a))
            }
            const lum = (rgb) =>
              rgb
                .map((c) => c / 255)
                .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
                .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0)
            const background = (n) => {
              const layers = []
              while (n) {
                layers.push(parse(getComputedStyle(n).backgroundColor))
                n = n.parentElement
              }
              return layers.reverse().reduce((bg, fg) => blend(fg, bg), [0, 0, 0])
            }
            return {
              overflow: document.documentElement.scrollWidth - innerWidth,
              root: getComputedStyle(document.querySelector("main")).backgroundColor,
              credit: document.querySelector(".studio-signature img").getAttribute("src"),
              values: selectors.flatMap((s) =>
                [...document.querySelectorAll(s)]
                  .filter((n) => n.getClientRects().length)
                  .map((n) => {
                    const style = getComputedStyle(n),
                      bg = background(n),
                      fg = blend(parse(style.color), bg),
                      a = lum(fg),
                      b = lum(bg)
                    return {
                      selector: s,
                      tag: n.tagName,
                      color: style.color,
                      bg,
                      ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
                      large: parseFloat(style.fontSize) >= 24,
                    }
                  }),
              ),
            }
          }, selectors)
          assert.equal(metrics.overflow, 0, `${name} ${route} ${width} overflow`)
          assert.equal(metrics.root, "rgb(8, 15, 17)")
          assert.match(metrics.credit, /logo-full-w/)
          for (const v of metrics.values)
            assert.ok(v.ratio >= (v.large ? 3 : 4.5), `Contrast ${name} ${route} ${width}: ${JSON.stringify(v)}`)
          if (width === 390) {
            await p.getByRole("button", { name: "Abrir menú" }).click()
            assert.deepEqual(
              await p
                .getByRole("dialog")
                .evaluate((n) => ({ bg: getComputedStyle(n).backgroundColor, fg: getComputedStyle(n).color })),
              { bg: "rgb(8, 15, 17)", fg: "rgb(238, 246, 243)" },
            )
            await p.getByRole("button", { name: "Cerrar menú" }).click()
          }
          if (width === 390 || width === 1440) {
            await p.screenshot({
              path: `/tmp/lify-palette-${name}-${route === "/" ? "home" : route.slice(1)}-${width}.png`,
            })
            await p.locator(".studio-credit").scrollIntoViewIfNeeded()
            await p.screenshot({ path: `/tmp/lify-palette-${name}-footer-${width}.png` })
          }
          console.log(`${name} ${route} ${width}: dark palette, text/control contrast, layout and footer: OK`)
          await p.close()
        }
      assert.deepEqual(errors, [])
    } finally {
      await b.close()
    }
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
