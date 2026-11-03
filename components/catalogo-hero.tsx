"use client"

import { useEffect, useRef, type MouseEvent } from "react"
import Image from "next/image"
import { ArrowDown, ArrowUpRight, CreditCard, Sparkles } from "lucide-react"
import { ProductGlyph, type ProductKind } from "@/components/product-glyph"
import { useCatalogPortal } from "@/components/use-catalog-portal"

const selections = [
  {
    id: "snacks",
    name: "Snacks",
    note: "Pequeños grandes antojos.",
    image: "/images/catalog/snacks.webp",
    alt: "Frutos secos variados",
  },
  {
    id: "bebidas-frias",
    name: "Bebidas frías",
    note: "Una pausa que refresca.",
    image: "/images/catalog/cold-drinks.webp",
    alt: "Selección de refrescos",
  },
  {
    id: "bebidas-calientes",
    name: "Café y calientes",
    note: "Tu ritual de cada día.",
    image: "/images/catalog/coffee.webp",
    alt: "Cappuccino con espuma",
  },
]

export function CatalogoHero() {
  const section = useRef<HTMLElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const machine = useRef<HTMLDivElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const directLink = useRef<HTMLAnchorElement>(null)
  useCatalogPortal(section, viewport, machine, glass, world, directLink)
  useEffect(() => {
    const openLinkedCategory = () => {
      const category = document.getElementById(window.location.hash.slice(1))
      if (category instanceof HTMLDetailsElement && category.classList.contains("catalog-category"))
        category.open = true
    }
    openLinkedCategory()
    window.addEventListener("hashchange", openLinkedCategory)
    window.addEventListener("popstate", openLinkedCategory)
    return () => {
      window.removeEventListener("hashchange", openLinkedCategory)
      window.removeEventListener("popstate", openLinkedCategory)
    }
  }, [])

  const enter = (event: MouseEvent<HTMLAnchorElement>) => {
    const node = section.current
    const frame = viewport.current
    if (!node || !frame || !node.classList.contains("is-portal-active")) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    if (event.detail === 0) node.dataset.portalFocus = "pending"
    window.scrollTo({
      top: window.scrollY + node.getBoundingClientRect().top + (node.offsetHeight - frame.offsetHeight) * 0.98,
      behavior: "smooth",
    })
  }
  const choose = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    const category = document.getElementById(id)
    if (!(category instanceof HTMLDetailsElement)) return
    event.preventDefault()
    category.open = true
    window.history.pushState(null, "", `#${id}`)
    category.querySelector("summary")?.focus({ preventScroll: true })
    // Reveal wrappers can still be translating as the link is followed. Use layout
    // coordinates so their entrance animation cannot move the final anchor position.
    let top = 0
    let ancestor: HTMLElement | null = category
    while (ancestor) {
      top += ancestor.offsetTop
      ancestor = ancestor.offsetParent as HTMLElement | null
    }
    window.scrollTo({
      top: top - (parseFloat(getComputedStyle(category).scrollMarginTop) || 100),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    })
  }

  return (
    <section ref={section} className="catalog-portal" aria-labelledby="catalog-title" data-portal-phase="outside">
      <div ref={viewport} className="catalog-portal-viewport">
        <div className="catalog-entry-copy">
          <span className="public-eyebrow">EL CATÁLOGO / MUCHO DONDE ELEGIR</span>
          <h1 id="catalog-title">
            A cada gusto,
            <br />
            <span>su pausa.</span>
          </h1>
          <p>
            Del primer café a ese último antojo.
            <br />
            Un surtido que se adapta a tu espacio y a tu gente.
          </p>
          <span className="catalog-entry-note">
            <Sparkles size={14} />
            Lo bueno está dentro.
          </span>
        </div>
        <span className="catalog-backdrop-word" aria-hidden="true">
          take a break.
        </span>
        <span className="catalog-machine-ground" aria-hidden="true" />
        <div ref={world} className="catalog-portal-world" inert aria-hidden="true">
          <div className="catalog-world-content">
            <div className="catalog-world-heading">
              <div>
                <span className="public-eyebrow">BIENVENIDO A TU PRÓXIMA PAUSA</span>
                <h2>
                  Lo bueno
                  <br />
                  <span>está dentro.</span>
                </h2>
              </div>
              <p>
                Elige por dónde empezar.
                <br />
                Nosotros nos ocupamos del resto.
              </p>
            </div>
            <div className="catalog-world-cards">
              {selections.map((selection) => (
                <a
                  key={selection.id}
                  href={`#${selection.id}`}
                  className="catalog-world-card"
                  onClick={(event) => choose(event, selection.id)}
                >
                  <Image src={selection.image} alt={selection.alt} fill sizes="(max-width: 767px) 90vw, 30vw" />
                  <span className="catalog-world-card-shade" aria-hidden="true" />
                  <span className="catalog-world-card-copy">
                    <small>{selection.note}</small>
                    <strong>{selection.name}</strong>
                  </span>
                  <ArrowUpRight size={24} aria-hidden="true" />
                </a>
              ))}
            </div>
            <div className="catalog-world-bottom">
              <span>UN SURTIDO A LA MEDIDA DE TU ESPACIO.</span>
              <a href="#varios" onClick={(event) => choose(event, "varios")}>
                Y mucho más <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </div>
        <div ref={machine} className="catalog-machine" aria-hidden="true">
          <div className="catalog-machine-body" />
          <div className="catalog-machine-brand">
            <strong>lify.</strong>
            <span>
              GOOD BREAKS.
              <br />
              BETTER DAYS.
            </span>
          </div>
          <div ref={glass} className="catalog-machine-window">
            <div className="catalog-window-stock">
              {(["snack", "water", "coffee"] as ProductKind[]).map((kind, row) => (
                <div className="catalog-stock-shelf" key={kind}>
                  <div>
                    {[0, 1, 2].map((column) => (
                      <ProductGlyph key={column} kind={kind} />
                    ))}
                  </div>
                  <span>{["SNACKS", "BEBIDAS", "CAFÉ"][row]}</span>
                </div>
              ))}
            </div>
            <span className="catalog-window-reflection" />
          </div>
          <div className="catalog-machine-screen">
            <Sparkles size={19} />
            <span>
              Tu pausa
              <br />
              empieza aquí.
            </span>
          </div>
          <div className="catalog-machine-payment">
            <CreditCard size={20} />
          </div>
          <span className="catalog-machine-handle" />
          <div className="catalog-machine-delivery">
            <span>TAKE A BREAK.</span>
          </div>
          <span className="catalog-machine-feet" />
        </div>
        <div className="catalog-portal-footer">
          <a href="#productos" className="catalog-enter-cue" onClick={enter}>
            <ArrowDown size={18} />
            <span className="catalog-cue-enhanced">Baja. Entra en la máquina.</span>
            <span className="catalog-cue-static">Descubre los productos</span>
          </a>
          <a ref={directLink} href="#productos" className="catalog-direct-link">
            Ver productos <ArrowUpRight size={15} />
          </a>
          <span className="catalog-portal-rail" aria-hidden="true">
            <span />
          </span>
        </div>
      </div>
    </section>
  )
}
