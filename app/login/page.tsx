"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, User, ArrowLeft, ArrowUpRight, Eye, EyeOff, ShieldCheck, LoaderCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import companyLogo from "@/public/logo.png"
import { LoginScene } from "@/components/login-scene"
import "./login.css"
import { supabase } from "@/lib/supabase-helpers"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [accessGranted, setAccessGranted] = useState(false)
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (transitionTimer.current) clearTimeout(transitionTimer.current)
    }
  }, [])

  const enterPanel = async (destination: string) => {
    if (!mounted.current) return
    setAccessGranted(true)
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await new Promise<void>((resolve) => {
        transitionTimer.current = setTimeout(resolve, 420)
      })
    }
    if (mounted.current) router.push(destination)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || accessGranted) return
    setLoading(true)
    setErrorMessage(null) // Limpiar errores anteriores

    try {
      // Login con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      // Manejo específico de errores de autenticación
      if (error) {
        // Log solo en desarrollo (opcional para debugging)
        if (process.env.NODE_ENV === "development") {
          console.log("[LOGIN] Error de autenticación:", error.message)
        }

        // Mensajes de error personalizados según el tipo
        if (
          error.message.includes("Invalid login credentials") ||
          error.message.includes("Invalid email or password")
        ) {
          const msg = "Email o contraseña incorrectos"
          setErrorMessage(msg)
          toast.error(msg, {
            description: "Por favor verifica tus credenciales e intenta de nuevo",
            duration: 4000,
          })
          return
        } else if (error.message.includes("Email not confirmed")) {
          const msg = "Email no confirmado"
          setErrorMessage(msg)
          toast.error(msg, {
            description: "Por favor confirma tu email antes de iniciar sesión",
            duration: 4000,
          })
          return
        } else if (error.message.includes("Too many requests")) {
          const msg = "Demasiados intentos"
          setErrorMessage(msg)
          toast.error(msg, {
            description: "Por favor espera unos minutos antes de intentar de nuevo",
            duration: 5000,
          })
          return
        } else {
          setErrorMessage("Error al iniciar sesión")
          toast.error("Error al iniciar sesión", {
            description: error.message,
            duration: 4000,
          })
          return
        }
      }

      if (!data.user) {
        const msg = "No se pudo obtener la información del usuario"
        setErrorMessage(msg)
        toast.error("Error al iniciar sesión", {
          description: msg,
          duration: 4000,
        })
        return
      }

      // Obtener perfil para verificar rol
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single<{ role: string }>()

      // Si no existe perfil, el usuario no está autorizado
      if (profileError || !profile) {
        if (process.env.NODE_ENV === "development") {
          console.log("[LOGIN] Perfil no encontrado para usuario:", data.user.id)
        }
        console.error("[LOGIN] Perfil no encontrado para usuario:", data.user.id)

        // Cerrar sesión ya que no tiene perfil válido
        await supabase.auth.signOut()

        const msg = "Tu cuenta no tiene un perfil asignado"
        setErrorMessage(msg)
        toast.error("Usuario no autorizado", {
          description: msg + ". Contacta al administrador.",
          duration: 5000,
        })
        return
      }

      console.log("[LOGIN] Perfil encontrado, rol:", profile.role)

      // Redirigir según rol
      // Redirigir según rol
      if (profile.role === "admin") {
        toast.success("Bienvenido, administrador")
        await enterPanel("/admin/dashboard")
      } else if (profile.role === "client") {
        toast.success("Bienvenido")
        await enterPanel("/client/dashboard")
      } else if (profile.role === "operador") {
        toast.success("Bienvenido, operador")
        await enterPanel("/admin/inicio") // Operadores van a página de inicio
      } else if (profile.role === "reponedor") {
        toast.success("Bienvenido, reponedor")
        await enterPanel("/admin/gestion-rutas")
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log("[LOGIN] Rol no válido:", profile.role)
        }
        const msg = "Rol no autorizado"
        setErrorMessage(msg)
        toast.error(msg, {
          description: "Contacta al administrador para resolver este problema",
          duration: 4000,
        })
        return
      }
    } catch (error: any) {
      // Captura de errores inesperados
      setErrorMessage("Error inesperado al iniciar sesión")
      toast.error("Error inesperado", {
        description: "Error inesperado al iniciar sesión. Intenta de nuevo.",
        duration: 4000,
      })
      if (process.env.NODE_ENV === "development") {
        console.log("[LOGIN] Error inesperado:", error)
      }
    } finally {
      // SIEMPRE liberar el estado de loading
      setLoading(false)
    }
  }

  return (
    <main className="login-experience" data-phase={accessGranted ? "granted" : loading ? "loading" : "idle"}>
      <header className="login-header">
        <Link href="/" className="login-brand" aria-label="Lify Vending, inicio">
          <Image src={companyLogo} alt="" sizes="124px" priority />
        </Link>
        <Link href="/" className="login-back">
          <ArrowLeft size={15} /> Volver a la web
        </Link>
      </header>
      <div className="login-layout">
        <LoginScene phase={accessGranted ? "granted" : loading ? "loading" : "idle"} />
        <section className="login-panel" aria-labelledby="login-title">
          <span className="login-panel-accent" aria-hidden="true" />
          <div className="login-panel-heading">
            <span className="login-eyebrow">
              <Lock size={13} /> TU ESPACIO LIFY
            </span>
            <h1 id="login-title">
              Área privada<span>.</span>
            </h1>
            <p>Accede con tu email y contraseña.</p>
          </div>
          {errorMessage && (
            <div className="login-error" id="login-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              <div>
                <strong>Error de autenticación</strong>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}
          <form onSubmit={handleLogin} className="login-form" aria-busy={loading || accessGranted}>
            <div className="login-field">
              <Label htmlFor="email">Email</Label>
              <div className="login-input-wrap">
                <User size={17} aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setErrorMessage(null)
                  }}
                  className="login-input"
                  required
                  disabled={loading || accessGranted}
                  aria-invalid={errorMessage === "Email o contraseña incorrectos" || undefined}
                  aria-describedby={errorMessage ? "login-error" : undefined}
                />
              </div>
            </div>
            <div className="login-field">
              <Label htmlFor="password">Contraseña</Label>
              <div className="login-input-wrap">
                <Lock size={17} aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrorMessage(null)
                  }}
                  className="login-input login-password"
                  required
                  disabled={loading || accessGranted}
                  aria-invalid={errorMessage === "Email o contraseña incorrectos" || undefined}
                  aria-describedby={errorMessage ? "login-error" : undefined}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  disabled={loading || accessGranted}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="login-submit" disabled={loading || accessGranted}>
              <span>
                {accessGranted ? "Entrando a tu espacio…" : loading ? "Iniciando sesión…" : "Entrar al panel"}
              </span>
              {loading && !accessGranted ? (
                <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />
              ) : (
                <ArrowUpRight size={19} aria-hidden="true" />
              )}
            </Button>
          </form>
          <div className="login-status" role="status" aria-live="polite">
            {accessGranted ? "Acceso validado. Abriendo tu panel." : ""}
          </div>
          <p className="login-restricted">
            <ShieldCheck size={16} aria-hidden="true" /> Acceso exclusivo para personal autorizado.
          </p>
        </section>
      </div>
      <footer className="login-footer">
        <span>BUENAS PAUSAS. MEJORES DÍAS.</span>
        <span>© {new Date().getFullYear()} Lify Vending</span>
      </footer>
    </main>
  )
}
