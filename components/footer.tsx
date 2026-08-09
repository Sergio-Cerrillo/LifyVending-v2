"use client"

import Image from "next/image"
import Link from "next/link"
import { Instagram, Mail, MapPin, Phone } from "lucide-react"

export function Footer() {
  return (
    <footer className="relative border-t border-border px-4 py-10 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="Lify Vending Logo" width={64} height={64} className="h-16 w-16 object-contain" />
            <div>
              <p className="text-2xl font-black tracking-[-0.04em] text-foreground">Lify Vending</p>
              <p className="text-sm font-semibold text-muted-foreground">Tu negocio sin inversión</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="mailto:info@lifyvending.com" className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-black text-foreground shadow-sm transition hover:border-primary hover:text-primary">
              <Mail className="h-4 w-4" />
              Email
            </a>
            <a href="tel:+34692129851" className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-black text-foreground shadow-sm transition hover:border-primary hover:text-primary">
              <Phone className="h-4 w-4" />
              Llamar
            </a>
            <a href="https://www.instagram.com/lify.vending" target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-black text-foreground shadow-sm transition hover:border-primary hover:text-primary">
              <Instagram className="h-4 w-4" />
              Instagram
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 text-sm font-semibold text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© 2026 Lify Vending. Todos los derechos reservados.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Calle Mozart, Local 10A · Islas Baleares
            </span>
            <Link href="/login" className="font-black text-foreground transition hover:text-primary">Área privada</Link>
          </div>
        </div>

        <div className="mt-6 flex justify-center md:justify-end">
          <div className="glass rounded-full px-4 py-2 text-xs font-medium">
            <p className="text-center text-sm text-muted-foreground">Desarrollado por:</p>
            <Link
              href="https://scwebstudio.tech"
              className="group block transition-opacity hover:opacity-80"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/logo-full-b.png"
                alt="SCWebStudio"
                className="h-16 w-auto transition-transform group-hover:scale-105"
              />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
