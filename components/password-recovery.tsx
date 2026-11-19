"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase-helpers"
import { withTimeout } from "@/lib/client-timeouts"
import companyLogo from "@/public/logo.png"
import "@/app/login/login.css"

export function PasswordRecovery({ mode }: { mode: "request" | "update" }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [ready, setReady] = useState(mode === "request")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (mode !== "update") return
    let active = true
    const invalidLink = "El enlace ha caducado o no es válido. Solicita un nuevo correo de recuperación."
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (hash.has("error") || new URLSearchParams(window.location.search).has("error")) {
      window.history.replaceState(null, "", window.location.pathname)
      setError(invalidLink)
      return
    }
    // getSession waits for the SDK to validate and consume the recovery tokens.
    withTimeout(supabase.auth.getSession(), 15_000).then(({ data, error }) => {
      if (!active) return
      if (error || !data.session) setError(invalidLink)
      else setReady(true)
    }).catch(() => {
      if (active) setError("No se pudo validar el enlace. Vuelve a intentarlo.")
    })
    return () => { active = false }
  }, [mode])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !ready || done) return
    setError("")
    if (mode === "update" && password !== confirmation) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setBusy(true)
    try {
      if (mode === "request") {
        const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/restablecer-contrasena`,
        }), 15_000)
        if (error) throw error
      } else {
        const { error } = await withTimeout(supabase.auth.updateUser({ password }), 15_000)
        if (error) throw error
        // Password is already saved, even if local session cleanup fails.
        await withTimeout(supabase.auth.signOut({ scope: "local" }), 5_000).catch(() => {})
      }
      setDone(true)
    } catch {
      setError(mode === "request"
        ? "No se pudo solicitar el correo. Espera un momento y vuelve a intentarlo."
        : "No se pudo cambiar la contraseña. Comprueba que cumple los requisitos y que el enlace sigue vigente.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-experience">
      <header className="login-header">
        <Link href="/" className="login-brand" aria-label="Lify Vending, inicio">
          <Image src={companyLogo} alt="" sizes="124px" priority />
        </Link>
        <Link href="/login" className="login-back">Volver al acceso</Link>
      </header>
      <section className="login-panel" aria-labelledby="recovery-title" style={{ maxWidth: 520, margin: "40px auto" }}>
        <div className="login-panel-heading">
          <span className="login-eyebrow"><Lock size={16} /> TU ESPACIO LIFY</span>
          <h1 id="recovery-title">{mode === "request" ? "Recuperar acceso" : "Nueva contraseña"}<span>.</span></h1>
          <p>{mode === "request" ? "Te enviaremos un enlace para cambiar tu contraseña." : "Elige una contraseña de al menos 8 caracteres."}</p>
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        {done ? (
          <div role="status" className="login-form">
            <p>{mode === "request" ? "Si existe una cuenta con ese email, recibirás un enlace de recuperación. Revisa también la carpeta de spam." : "Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña."}</p>
            <Link href="/login" className="login-back">Ir al acceso</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="login-form" aria-busy={busy}>
            {mode === "request" ? (
              <div className="login-field">
                <Label htmlFor="recovery-email">Email</Label>
                <Input id="recovery-email" className="login-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} />
              </div>
            ) : ready ? (
              <>
                <div className="login-field">
                  <Label htmlFor="new-password">Nueva contraseña</Label>
                  <Input id="new-password" className="login-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} />
                </div>
                <div className="login-field">
                  <Label htmlFor="confirm-password">Repite la contraseña</Label>
                  <Input id="confirm-password" className="login-input" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} required disabled={busy} />
                </div>
              </>
            ) : !error ? <p role="status">Validando el enlace…</p> : null}
            <Button className="login-submit" type="submit" disabled={busy || !ready}>
              {busy ? "Procesando…" : mode === "request" ? "Enviar enlace de recuperación" : "Guardar contraseña"}
            </Button>
            {mode === "update" && <Link href="/recuperar-contrasena" className="login-back">Solicitar un nuevo enlace</Link>}
          </form>
        )}
      </section>
    </main>
  )
}
