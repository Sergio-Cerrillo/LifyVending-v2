import Link from "next/link"
import { ArrowDown, ArrowUpRight } from "lucide-react"
import { HeroVisual } from "@/components/hero-visual"

export function HeroSection() {
  return (
    <section
      className="public-hero public-hero--cinema"
      data-scene="hero"
      data-startup="pending"
      aria-labelledby="hero-title"
    >
      <div className="hero-coordinate public-eyebrow">
        <span className="status-dot" />
        DESDE MALLORCA, PARA TU DÍA A DÍA
      </div>
      <div className="hero-copy">
        <h1 id="hero-title">
          <span>Tu pausa.</span>
          <span>Nuestra</span>{" "}
          <span className="hero-green">
            energía<span className="hero-period">.</span>
          </span>
        </h1>
        <p>
          Vending para espacios deportivos, oficinas y hoteles.
          <br />
          Sin inversión. Sin complicaciones. Con Lify.
        </p>
        <Link href="/#contacto" className="public-button">
          Dale vida a tu espacio <ArrowUpRight size={20} />
        </Link>
      </div>
      <HeroVisual />
      <div className="hero-bottom">
        <a href="#descubre" className="scroll-cue">
          <span className="scroll-cue-icon">
            <ArrowDown size={16} />
          </span>
          Lo bueno está por venir
        </a>
        <span className="public-eyebrow">CAFÉ · SNACKS · BEBIDAS · Y MUCHO MÁS</span>
        <span className="hero-index">01 — 05</span>
      </div>
    </section>
  )
}
