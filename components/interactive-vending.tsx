"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowDown, ArrowUpRight, Check, Coffee, Droplets, Cookie, RotateCcw, Wifi, Wrench } from "lucide-react"
import { ProductGlyph, type ProductKind } from "@/components/product-glyph"

const products = [
  {
    id: "coffee" as ProductKind,
    name: "Café",
    code: "01",
    title: "Tu ritual favorito.",
    text: "Café y bebidas calientes para poner el día en marcha. Un pequeño momento que cambia el ritmo de una oficina, un hotel o tu espacio.",
    photo: "/espresso-coffee-cup.png",
    photoAspectRatio: 1,
    href: "/catalogo#bebidas-calientes",
    icon: Coffee,
    position: 0.1,
  },
  {
    id: "water" as ProductKind,
    name: "Agua",
    code: "02",
    title: "Un respiro fresco.",
    text: "Agua y bebidas frías a mano. Para la pausa del trabajo, entre partidos o después de entrenar. Elegimos el surtido contigo.",
    photo: "/mineral-water-bottle.jpg",
    photoAspectRatio: 1,
    href: "/catalogo#bebidas-frias",
    icon: Droplets,
    position: 0.39,
  },
  {
    id: "snack" as ProductKind,
    name: "Snacks",
    code: "03",
    title: "Ese pequeño antojo.",
    text: "Frutos secos, opciones saludables y pequeños antojos. Una selección que se adapta a las personas que dan vida a tu espacio.",
    photo: "/mixed-nuts.png",
    photoAspectRatio: 1024 / 679,
    href: "/catalogo#snacks",
    icon: Cookie,
    position: 0.68,
  },
]

export function InteractiveVending() {
  const [selected, setSelected] = useState(0)
  const [phase, setPhase] = useState<"idle" | "dispensing" | "ready">("idle")
  const [cycle, setCycle] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const product = products[selected]
  const Icon = product.icon

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const dispense = (index: number) => {
    if (timer.current) clearTimeout(timer.current)
    setSelected(index)
    setCycle((value) => value + 1)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("ready")
      return
    }
    setPhase("dispensing")
    timer.current = setTimeout(() => {
      setPhase("ready")
      timer.current = null
    }, 1500)
  }

  const status =
    phase === "idle"
      ? "Elige tu pausa"
      : phase === "dispensing"
        ? `Preparando: ${product.name.toLowerCase()}`
        : `Tu pausa de ${product.name.toLowerCase()} está lista`

  return (
    <section id="servicios" className="interactive-vending public-section" aria-labelledby="vending-title">
      <div className="experience-heading">
        <div>
          <span className="public-eyebrow">02 / TU PRÓXIMA PAUSA EMPIEZA AQUÍ</span>
          <h2 id="vending-title">
            Toca. Elige.
            <br />
            <span>Disfruta.</span>
          </h2>
        </div>
        <p>
          Acércate a nuestra máquina.
          <br />
          Elige un producto y deja que ocurra.
        </p>
      </div>
      <div className="vending-playground" data-phase={phase} data-product={product.id}>
        <div className="vending-demo-stage">
          <span className="demo-background-type" aria-hidden="true">
            take a break.
          </span>
          <div className="demo-orbit" aria-hidden="true" />
          <div className="demo-machine" style={{ "--shelf-position": product.position } as CSSProperties}>
            <div className="demo-machine-header">
              <span>lify.</span>
              <small>
                BUENAS PAUSAS.
                <br />
                MEJORES DÍAS.
              </small>
              <span className="demo-header-star" aria-hidden="true">
                ✳
              </span>
            </div>
            <div className="demo-machine-front">
              <div className="demo-glass" role="group" aria-label="Elige un producto en la máquina">
                {products.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className="demo-shelf"
                    aria-label={`Elegir ${item.name.toLowerCase()}`}
                    aria-pressed={selected === index}
                    onClick={() => dispense(index)}
                  >
                    <span className="demo-shelf-products" aria-hidden="true">
                      <ProductGlyph kind={item.id} />
                      <ProductGlyph kind={item.id} />
                      <ProductGlyph kind={item.id} />
                    </span>
                    <span className="demo-shelf-label">
                      <span>
                        {item.code} / {item.name}
                      </span>
                      <ArrowDown size={12} />
                    </span>
                  </button>
                ))}
                {phase === "dispensing" && (
                  <div key={cycle} className="demo-falling-product" aria-hidden="true">
                    <ProductGlyph kind={product.id} />
                  </div>
                )}
                <span className="demo-glass-reflection" aria-hidden="true" />
              </div>
              <div className="demo-machine-controls" aria-hidden="true">
                <div className="demo-lcd">
                  <span>LIFY VENDING</span>
                  <Icon size={23} strokeWidth={1.5} />
                  <strong>{phase === "idle" ? "HOLA :)" : phase === "dispensing" ? "UN MOMENTO" : "¡DISFRUTA!"}</strong>
                  <small>
                    {phase === "idle" ? "ELIGE TU PAUSA" : `${product.code} / ${product.name.toUpperCase()}`}
                  </small>
                </div>
                <div className="demo-contactless">
                  <Wifi size={24} />
                  <span>A TU RITMO</span>
                </div>
                <div className="demo-machine-handle" />
                <span className="demo-machine-promise">
                  GOOD
                  <br />
                  BREAKS.
                </span>
              </div>
            </div>
            <div className="demo-machine-base">
              <div className="demo-delivery" aria-hidden="true">
                <span>TU PAUSA, AQUÍ ↓</span>
                {phase !== "idle" && (
                  <div
                    key={cycle}
                    className={`demo-delivered-product ${phase === "ready" ? "has-arrived" : "is-arriving"}`}
                  >
                    <ProductGlyph kind={product.id} />
                  </div>
                )}
              </div>
              <span className="demo-base-mark">
                24/7
                <br />
                <small>A TU LADO</small>
              </span>
            </div>
            <div className="demo-machine-feet" aria-hidden="true" />
          </div>
          <span className="demo-touch-note">
            <ArrowUpRight size={17} />
            Toca un producto de la máquina
          </span>
        </div>
        <div className="demo-product-story">
          <div className="demo-live-status" role="status" aria-live="polite" aria-atomic="true">
            <span className="status-dot" />
            {status}
          </div>
          <div
            className="demo-story-photo"
            key={product.id}
            style={{ "--photo-ratio": product.photoAspectRatio } as CSSProperties}
          >
            <div className="demo-story-photo-frame">
              <Image
                src={product.photo}
                alt={
                  product.id === "coffee"
                    ? "Café espresso"
                    : product.id === "water"
                      ? "Agua mineral"
                      : "Selección de frutos secos"
                }
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
              />
            </div>
          </div>
          <div className="demo-story-copy" key={`${product.id}-story`}>
            <span className="public-eyebrow">
              {product.code} / {product.name.toUpperCase()}
            </span>
            <h3>{product.title}</h3>
            <p>{product.text}</p>
          </div>
          <div className="demo-product-controls" role="group" aria-label="También puedes elegir tu pausa aquí">
            {products.map((item, index) => {
              const ProductIcon = item.icon
              return (
                <button key={item.id} type="button" aria-pressed={selected === index} onClick={() => dispense(index)}>
                  <ProductIcon size={16} />
                  {item.name}
                </button>
              )
            })}
          </div>
          <div className="demo-story-actions">
            <Link href={product.href} className="public-text-link">
              Explora la selección <ArrowUpRight size={18} />
            </Link>
            <button
              type="button"
              className="demo-repeat"
              onClick={() => dispense(selected)}
              aria-label="Repetir la experiencia"
            >
              <RotateCcw size={19} />
            </button>
          </div>
          <p className="demo-story-note">
            <Check size={14} />
            Un ejemplo de lo que puede vivir tu espacio.
          </p>
        </div>
      </div>
      <div className="demo-technical-bridge">
        <span>
          <Wrench size={19} />
          Detrás de cada pausa, también hay servicio técnico.
        </span>
        <Link href="/servicio-tecnico">
          Conoce cómo cuidamos tu máquina <ArrowUpRight size={17} />
        </Link>
      </div>
    </section>
  )
}
