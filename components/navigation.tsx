"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import companyLogo from "@/public/logo.png"
import { usePathname } from "next/navigation"
import { ArrowUpRight, LockKeyhole, Menu, X } from "lucide-react"

const links = [
  { href: "/", label: "Inicio" },
  { href: "/sobre-nosotros", label: "Nosotros" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/servicio-tecnico", label: "Servicio técnico" },
]

export function Navigation() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [ready, setReady] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24)
    update()
    setReady(true)
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])
  useEffect(() => {
    if (!open) {
      dialog.current?.close()
      return
    }
    dialog.current?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setOpen(false)
    }
    window.addEventListener("resize", closeOnDesktop)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("resize", closeOnDesktop)
    }
  }, [open])
  return (
    <nav className={`public-nav ${scrolled ? "is-scrolled" : ""}`} aria-label="Navegación principal">
      <Link href="/" className="public-brand" aria-label="Lify Vending, inicio">
        <span className="brand-original">
          <Image src={companyLogo} alt="" sizes="124px" priority />
        </span>
        <span className="brand-caption">
          VENDING
          <br />
          MALLORCA
        </span>
      </Link>
      <div className="public-desktop-links">
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
      </div>
      <div className="public-nav-actions">
        <Link href="/login" className="private-link">
          <LockKeyhole size={14} />
          Área privada
        </Link>
        <Link href="/#contacto" className="public-button small">
          Hablemos <ArrowUpRight size={16} />
        </Link>
        <button
          className="public-menu-toggle"
          disabled={!ready}
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="public-mobile-menu"
        >
          <Menu size={24} />
        </button>
      </div>
      <dialog
        ref={dialog}
        id="public-mobile-menu"
        className="public-mobile-menu"
        aria-label="Menú de navegación"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className="mobile-menu-top">
          <span className="brand-original">
            <Image src={companyLogo} alt="Lify Vending" sizes="124px" />
          </span>
          <button onClick={() => setOpen(false)} aria-label="Cerrar menú" autoFocus>
            <X size={28} />
          </button>
        </div>
        <div className="mobile-menu-links">
          {links.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              <span>0{i + 1}</span>
              <span className="mobile-link-label">{link.label}</span>
              <ArrowUpRight />
            </Link>
          ))}
        </div>
        <Link href="/#contacto" className="public-button" onClick={() => setOpen(false)}>
          Hablemos de tu espacio <ArrowUpRight size={20} />
        </Link>
        <Link href="/login" className="mobile-private" onClick={() => setOpen(false)}>
          <LockKeyhole size={16} />
          Área privada
        </Link>
        <p className="public-eyebrow">BUENAS PAUSAS. MEJORES DÍAS.</p>
      </dialog>
    </nav>
  )
}
