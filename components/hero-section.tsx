"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
          }
        })
      },
      { threshold: 0.1 },
    )

    if (heroRef.current) {
      observer.observe(heroRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center justify-center">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 sm:pt-40 lg:pt-32 pb-20 sm:pb-28 lg:pb-32 text-center">
        <div
          className={`inline-flex items-center gap-2 glass px-6 py-3 rounded-full mb-8 ${isVisible ? "animate-bounce-in" : "opacity-0"}`}
        >
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium text-primary dark:text-accent">Tu negocio sin inversión ni riesgos</span>
        </div>

        <h1
          className={`text-5xl sm:text-6xl lg:text-7xl font-semibold mb-8 leading-tight tracking-tight ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
          style={{ animationDelay: "0.1s" }}
        >
          <span className="block mb-2 bg-gradient-to-r from-primary via-emerald-600 to-emerald-500 bg-clip-text text-transparent">
            Máquinas Vending
          </span>
          <span className="block text-foreground relative">
            <span className="absolute inset-0 blur-3xl bg-primary/30 transform scale-110"></span>
            <span className="relative">Solo Beneficios</span>
          </span>
        </h1>

        <p
          className={`text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
          style={{ animationDelay: "0.2s" }}
        >
          Nosotros instalamos, mantenemos y reponemos. Tú solo recibes tu <span className="text-primary font-semibold">comisión</span> sin preocupaciones
        </p>

        <div
          className={`flex flex-col sm:flex-row justify-center gap-6 mb-16 ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
          style={{ animationDelay: "0.3s" }}
        >
          {[
            { value: "0€", label: "Inversión" },
            { value: "100%", label: "Mantenimiento" },
            { value: "24/7", label: "Soporte" },
          ].map((stat, index) => (
            <div
              key={index}
              className="glass glass-hover rounded-xl px-8 py-6 min-w-40 group touch-feedback border border-primary/10"
              style={{
                animationDelay: `${0.4 + index * 0.1}s`,
              }}
            >
              <div className="text-4xl font-bold bg-gradient-to-br from-primary to-emerald-600 bg-clip-text text-transparent mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wide font-medium">{stat.label}</div>
            </div>
          ))}
        </div>

        <div
          className={`flex flex-col sm:flex-row gap-4 justify-center mb-16 ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
          style={{ animationDelay: "0.7s" }}
        >
          <Link href="#contacto">
            <Button
              size="lg"
              className="touch-feedback text-base px-10 py-6 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
            >
              <span className="flex items-center gap-2">
                <span>Solicitar Información</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Button>
          </Link>
        </div>

        <div className={`text-sm text-muted-foreground ${isVisible ? "animate-fade-in" : "opacity-0"}`} style={{ animationDelay: "0.9s" }}>
          Más de 500 clientes confían en nosotros • Mantenimiento incluido • Soporte 24/7
        </div>
      </div>
    </section>
  )
}
