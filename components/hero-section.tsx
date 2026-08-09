"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, ChevronDown, PackageCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.12 },
    )

    if (heroRef.current) observer.observe(heroRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={heroRef} className="relative flex min-h-[100svh] items-center overflow-hidden px-4 pb-20 pt-32 sm:px-6 sm:pt-36 lg:px-8">
      <div className="absolute inset-0 z-0 overflow-hidden bg-zinc-950">
        <iframe
          title="Lify Vending background video"
          src="https://www.youtube-nocookie.com/embed/qVCyXG2-ecQ?autoplay=1&mute=1&controls=0&loop=1&playlist=qVCyXG2-ecQ&playsinline=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[120vh] min-h-full w-[213.34vh] min-w-[120vw] -translate-x-1/2 -translate-y-1/2 scale-110 border-0 opacity-70"
          allow="autoplay; encrypted-media; picture-in-picture"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="absolute inset-0 bg-zinc-950/68 sm:bg-zinc-950/48" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_56%,rgba(9,9,11,0.92),rgba(9,9,11,0.55)_18%,transparent_34%)] sm:hidden" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_35%,rgba(16,185,129,0.28),transparent_38%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/55 to-zinc-950/20" />
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-b from-transparent via-[#f7f8f6]/80 to-[#f7f8f6]" />
        <div className="absolute -bottom-28 left-1/2 h-56 w-[86vw] -translate-x-1/2 rounded-full bg-white/35 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <div className="max-w-5xl text-left">
          <div
            className={`mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-white shadow-2xl shadow-zinc-950/20 backdrop-blur-xl ${
              isVisible ? "animate-bounce-in" : "opacity-0"
            }`}
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Tu negocio sin inversión ni riesgos</span>
          </div>

          <h1
            className={`text-[clamp(3.5rem,14vw,9rem)] font-black leading-[0.86] tracking-[-0.07em] text-white drop-shadow-2xl ${
              isVisible ? "animate-reveal-up" : "opacity-0"
            }`}
            style={{ animationDelay: "0.1s" }}
          >
            Máquinas vending. Solo beneficios.
          </h1>

          <p
            className={`mt-7 max-w-2xl text-lg font-semibold leading-8 text-zinc-100 sm:text-xl ${
              isVisible ? "animate-reveal-up" : "opacity-0"
            }`}
            style={{ animationDelay: "0.2s" }}
          >
            Instalamos, mantenemos, monitorizamos y reponemos. Tú ofreces un servicio premium sin ocuparte de la operativa.
          </p>

          <div
            className={`mt-8 grid max-w-2xl grid-cols-3 gap-3 ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
            style={{ animationDelay: "0.3s" }}
          >
            {[
              { value: "0€", label: "Inversión" },
              { value: "24/7", label: "Servicio" },
              { value: "Datos", label: "Control" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/15 bg-white/10 p-4 text-center text-white shadow-2xl shadow-zinc-950/10 backdrop-blur-xl">
                <div className="text-2xl font-black tracking-tight text-primary sm:text-4xl">{stat.value}</div>
                <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-zinc-200 sm:text-xs">{stat.label}</div>
              </div>
            ))}
          </div>

          <div
            className={`mt-8 flex flex-col gap-3 sm:flex-row ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
            style={{ animationDelay: "0.45s" }}
          >
            <Link href="#contacto">
              <Button size="lg" className="h-14 w-full rounded-full bg-primary px-8 text-base font-black text-white shadow-xl shadow-primary/25 hover:bg-primary/90 sm:w-auto">
                Solicitar información
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#servicios">
              <Button size="lg" variant="outline" className="h-14 w-full rounded-full border-white/20 bg-white/95 px-8 text-base font-black text-zinc-950 shadow-sm hover:bg-white sm:w-auto">
                Ver servicios
                <ChevronDown className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div
            className={`mt-7 flex flex-col gap-2 text-sm font-bold text-zinc-100 sm:flex-row sm:items-center sm:gap-5 ${
              isVisible ? "animate-fade-in" : "opacity-0"
            }`}
            style={{ animationDelay: "0.65s" }}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Mantenimiento incluido
            </span>
            <span className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-primary" />
              Reposición inteligente
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
