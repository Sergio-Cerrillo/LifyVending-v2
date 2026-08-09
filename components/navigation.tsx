"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, X, Lock } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const overHero = !scrolled

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navItems = [
    { href: "/", label: "Inicio" },
    { href: "/sobre-nosotros", label: "Sobre Nosotros" },
    { href: "/catalogo", label: "Catálogo" },
  ]

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3 transition-all duration-500 sm:top-5 sm:px-5"
    >
      <div
        className={`pointer-events-auto mx-auto max-w-7xl rounded-[1.75rem] border border-white/30 px-4 shadow-2xl shadow-zinc-950/10 ring-1 ring-white/25 backdrop-blur-md backdrop-saturate-150 transition-all duration-500 sm:px-6 lg:px-8 ${
          scrolled
            ? "bg-white/70 py-2"
            : "bg-white/[0.16] py-3 sm:py-4"
        }`}
      >
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-4 group">
            <div className="relative flex h-14 w-14 items-center justify-center transition-all duration-300 group-hover:scale-105 sm:h-16 sm:w-16">
              <Image
                src="/logo.png"
                alt="Lify Vending Logo"
                width={64}
                height={64}
                className="object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-2xl bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Lify Vending
              </span>
              <div className={`text-xs font-semibold transition-colors ${overHero ? "text-white/70" : "text-zinc-600"}`}>Tu negocio sin inversión</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-full px-4 py-2 font-semibold transition-colors hover:bg-white/20 ${
                  overHero ? "text-white/90 hover:text-white" : "text-zinc-800 hover:text-zinc-950"
                }`}
              >
                {item.label}
              </Link>
            ))}

            <Link href="#contacto">
              <Button
                size="lg"
                className="ml-4 rounded-2xl bg-gradient-to-r from-primary to-secondary font-bold text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-[1.03] hover:from-primary/90 hover:to-secondary/90 hover:shadow-xl hover:shadow-primary/30"
              >
                Solicitar Información
              </Button>
            </Link>

            <Link href="/login" title="AccesoAdmin">
              <Button
                variant="ghost"
                size="lg"
                className="ml-4 rounded-2xl bg-gradient-to-r from-primary to-secondary font-bold text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-[1.03] hover:from-primary/90 hover:to-secondary/90 hover:shadow-xl hover:shadow-primary/30"
              >

                <Lock className="h-4 w-4" />
                Área Privada
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-4">
            <button
              className="rounded-2xl border border-white/30 bg-white/35 p-3 shadow-sm backdrop-blur-md transition-transform hover:scale-105"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={24} className="text-foreground" /> : <Menu size={24} className="text-foreground" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide Menu */}
        {isOpen && (
          <div className="mx-auto mt-4 max-w-sm animate-slide-up rounded-[1.5rem] border border-white/30 bg-white/35 p-5 shadow-2xl shadow-zinc-950/10 backdrop-blur-md lg:hidden">
            <div className="space-y-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-foreground transition-colors hover:bg-white/30"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}

              <Link href="#contacto" className="w-full block">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/30 font-bold text-white"
                >
                  Solicitar Información
                </Button>
              </Link>

              <Link href="/login" className="w-full block">
                <Button
                  variant="outline"
                  size="default"
                  className="w-full border-2 border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-all duration-300 font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Acceso Admin
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
