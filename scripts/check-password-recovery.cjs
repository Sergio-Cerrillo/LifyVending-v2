// Synthetic auth only: no emails are sent and no accounts are modified.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const base = process.env.LIFY_PREVIEW_URL || 'http://localhost:3100'
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'qa@example.invalid', app_metadata: {}, user_metadata: {} }
const part = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const token = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })}.test`
;(async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    let recoveryRequest, updateRequest, updates = 0, failUpdate = true
    await page.route('**/auth/v1/**', async route => {
      const req = route.request(), url = new URL(req.url())
      if (url.pathname.endsWith('/recover')) {
        recoveryRequest = url
        return route.fulfill({ json: {} })
      }
      if (req.method() === 'PUT') {
        updates++
        updateRequest = req.postDataJSON()
        return route.fulfill(failUpdate ? { status: 400, json: { message: 'Password rejected' } } : { json: user })
      }
      return route.fulfill({ json: user })
    })
    await page.goto(`${base}/recuperar-contrasena`)
    await page.getByLabel('Email', { exact: true }).fill(user.email)
    await page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click()
    await page.getByRole('status').filter({ hasText: 'Si existe una cuenta' }).waitFor()
    assert.equal(recoveryRequest.searchParams.get('redirect_to'), `${base}/restablecer-contrasena`)
    await page.goto(`${base}/restablecer-contrasena`)
    await page.getByRole('alert').filter({ hasText: 'caducado' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Guardar contraseña' }).isDisabled(), true)
    await page.goto('about:blank')
    await page.goto(`${base}/restablecer-contrasena#error=access_denied&error_description=expired`)
    await page.getByRole('alert').filter({ hasText: 'caducado' }).waitFor()
    assert.equal(new URL(page.url()).hash, '')
    await page.goto(`${base}/#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=recovery`)
    await page.waitForURL('**/restablecer-contrasena**')
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('test-password-123')
    await page.getByLabel('Repite la contraseña').fill('mismatch-password')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await page.getByRole('alert').filter({ hasText: 'no coinciden' }).waitFor()
    assert.equal(updates, 0)
    await page.getByLabel('Repite la contraseña').fill('test-password-123')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await page.getByRole('alert').filter({ hasText: 'No se pudo cambiar' }).waitFor()
    failUpdate = false
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await page.getByRole('status').filter({ hasText: 'Contraseña actualizada' }).waitFor()
    assert.equal(updateRequest.password, 'test-password-123')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: '/tmp/lify-password-recovery.png', fullPage: true })
    console.log('PASS: recovery destination, missing/expired links, homepage recovery redirect, mismatch, failed update, successful update and mobile width.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
