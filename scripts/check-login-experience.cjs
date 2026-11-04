// Browser checks use synthetic responses; no real authentication or panel data is accessed.
const assert = require("node:assert/strict")
const { chromium, webkit } = require("playwright")
const base = process.env.LIFY_PREVIEW_URL || "http://localhost:3000"
const sizes = [
  [320, 740],
  [375, 812],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1440, 700],
  [1440, 900],
  [1920, 1080],
  [844, 390],
]
const userId = "00000000-0000-4000-8000-000000000001"
const testEmail = "qa-login@example.invalid"
const testPassword = "test-password-only"
const token = () => {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")
  const access = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })}.qa-signature`
  return {
    access_token: access,
    refresh_token: "qa-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: testEmail,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    },
  }
}
async function open(page) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => document.querySelector(".login-scene")?.dataset.visible !== undefined)
}
async function fill(page) {
  await page.getByLabel("Email", { exact: true }).fill(testEmail)
  await page.getByLabel("Contraseña", { exact: true }).fill(testPassword)
}
async function mock(page, role, { authError = false, profileMissing = false } = {}) {
  let signouts = 0,
    authCalls = 0,
    payload,
    release
  const pending = new Promise((resolve) => (release = resolve))
  let resolveNavigation
  const navigation = new Promise((resolve) => (resolveNavigation = resolve))
  await page.route("**/auth/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/token")) {
      authCalls++
      payload = route.request().postDataJSON()
      await pending
      await route.fulfill({
        status: authError ? 400 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          authError ? { code: "invalid_credentials", message: "Invalid login credentials" } : token(),
        ),
      })
    } else if (path.endsWith("/logout")) {
      signouts++
      await route.fulfill({ status: 204 })
    } else await route.abort()
  })
  await page.route("**/rest/v1/profiles*", (route) =>
    route.fulfill({
      status: profileMissing ? 406 : 200,
      contentType: "application/json",
      body: JSON.stringify(profileMissing ? { code: "PGRST116", message: "Profile not found" } : { role }),
    }),
  )
  // Keep destination requests intercepted, proving routing without rendering private screens.
  for (const path of ["**/admin/**", "**/client/**"])
    await page.route(path, (route) => {
      resolveNavigation(new URL(route.request().url()).pathname)
    })
  await page.route("**/api/**", (route) => route.abort())
  return { release, navigation, stats: () => ({ signouts, authCalls, payload }) }
}
;(async () => {
  for (const [name, engine] of [
    ["Chromium", chromium],
    ["WebKit", webkit],
  ]) {
    const browser = await engine.launch()
    const errors = []
    try {
      for (const [width, height] of sizes) {
        const page = await browser.newPage({
          viewport: { width, height },
          hasTouch: width < 768,
          isMobile: width < 768,
        })
        page.on("pageerror", (e) => errors.push(e.message))
        await open(page)
        assert.equal(await page.getByRole("heading", { level: 1 }).innerText(), "Área privada.")
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        for (const locator of [
          page.getByLabel("Email", { exact: true }),
          page.getByLabel("Contraseña", { exact: true }),
          page.locator(".login-submit"),
          page.locator(".login-password-toggle"),
        ]) {
          const box = await locator.boundingBox()
          assert.ok(box.width >= 44 && box.height >= 44)
          assert.ok(box.x >= 0 && box.x + box.width <= width)
        }
        await fill(page)
        await page.getByRole("button", { name: "Mostrar contraseña" }).click()
        assert.equal(await page.locator("#password").getAttribute("type"), "text")
        assert.equal(await page.locator("#password").inputValue(), testPassword)
        await page.getByRole("button", { name: "Ocultar contraseña" }).click()
        assert.equal(await page.locator("#password").getAttribute("type"), "password")
        assert.equal(await page.locator("#email").getAttribute("autocomplete"), "username")
        assert.equal(await page.locator("#password").getAttribute("autocomplete"), "current-password")
        await page.waitForTimeout(1700)
        const running = await page
          .locator(".login-experience")
          .evaluate((n) => n.getAnimations({ subtree: true }).filter((a) => a.playState === "running"))
        assert.equal(running.length, 0, "Decorative animation should finish")
        if (width === 390 || width === 1440)
          await page.screenshot({ path: `/tmp/lify-login-final-${name}-${width}.png` })
        console.log(`${name} login layout, fields, password visibility and finite motion ${width}x${height}: OK`)
        await page.close()
      }
      for (const [role, path] of [
        ["admin", "/admin/dashboard"],
        ["client", "/client/dashboard"],
        ["operador", "/admin/inicio"],
        ["reponedor", "/admin/gestion-rutas"],
      ]) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
        const simulated = await mock(page, role)
        await open(page)
        await page.getByRole("button", { name: "Entrar al panel", exact: true }).click()
        assert.equal(simulated.stats().authCalls, 0, "Empty form must use native validation")
        await fill(page)
        await page.getByRole("button", { name: "Entrar al panel", exact: true }).click()
        await page.waitForFunction(() => document.querySelector(".login-experience").dataset.phase === "loading")
        assert.ok(await page.locator("#email").isDisabled())
        assert.ok(await page.locator("#password").isDisabled())
        assert.equal(simulated.stats().authCalls, 1)
        assert.deepEqual(simulated.stats().payload.email, testEmail)
        assert.deepEqual(simulated.stats().payload.password, testPassword)
        simulated.release()
        await page.waitForFunction(() => document.querySelector(".login-experience").dataset.phase === "granted")
        assert.ok(await page.getByRole("status").filter({ hasText: "Acceso validado" }).isVisible())
        assert.ok(await page.locator(".login-submit").isDisabled())
        assert.equal(
          await Promise.race([
            simulated.navigation,
            new Promise((_, reject) => setTimeout(() => reject(Error("No role destination")), 8000)),
          ]),
          path,
        )
        console.log(`${name} simulated ${role}: validated success transition and ${path}: OK`)
        await page.close()
      }
      for (const kind of ["credentials", "profile", "role"]) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
        const simulated = await mock(page, kind === "role" ? "unknown" : "client", {
          authError: kind === "credentials",
          profileMissing: kind === "profile",
        })
        simulated.release()
        await open(page)
        await fill(page)
        await page.locator(".login-submit").click()
        const expected =
          kind === "credentials"
            ? "Email o contraseña incorrectos"
            : kind === "profile"
              ? "Tu cuenta no tiene un perfil asignado"
              : "Rol no autorizado"
        await page.locator("#login-error").filter({ hasText: expected }).waitFor()
        assert.equal(await page.locator(".login-experience").getAttribute("data-phase"), "idle")
        assert.ok(await page.locator("#password").isEnabled())
        assert.equal(simulated.stats().signouts, kind === "profile" ? 1 : 0)
        await page.getByLabel("Email", { exact: true }).fill("edited@example.invalid")
        assert.equal(await page.locator("#login-error").count(), 0)
        assert.equal(
          await page.locator(".login-experience").evaluate((n) => n.getAnimations({ subtree: true }).length),
          0,
        )
        console.log(`${name} simulated ${kind} error, recovery and reduced motion: OK`)
        await page.close()
      }
      assert.deepEqual(errors, [])
    } finally {
      await browser.close()
    }
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
