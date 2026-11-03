"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowDown, ArrowUpRight, Building2, Dumbbell, Hotel } from "lucide-react"
import { useScrollChapters } from "@/components/experience-motion"

const spaces = [
  {
    id: "sport",
    image: "gimnasio",
    alt: "Visualización de una máquina Lify con iluminación turquesa en un gimnasio.",
    name: "Deporte",
    icon: Dumbbell,
    title: "A pie de pista.",
    text: "Estamos instalando máquinas en zonas deportivas. Bebidas y snacks para quienes entrenan, compiten o acompañan.",
    tag: "ANTES. ENTRE PARTIDOS. DESPUÉS.",
    cta: "Vending para mi centro",
    selection: "Agua · Bebidas · Snacks",
  },
  {
    id: "office",
    image: "oficina",
    alt: "Visualización de una máquina Lify integrada en una zona de descanso de oficina.",
    name: "Oficina",
    icon: Building2,
    title: "Entre buenas ideas.",
    text: "Un café compartido. Algo rico entre reuniones. Una pausa que da vida a la oficina, con un surtido pensado para tu equipo.",
    tag: "PEQUEÑAS PAUSAS. GRANDES IDEAS.",
    cta: "Vending para mi oficina",
    selection: "Café · Agua · Snacks",
  },
  {
    id: "hotel",
    image: "hotel",
    alt: "Visualización de una máquina Lify en el vestíbulo de un hotel.",
    name: "Hotel",
    icon: Hotel,
    title: "Un detalle que suma.",
    text: "Acompaña la estancia con bebidas y pequeños antojos a mano. Un servicio más para tus huéspedes, con Lify detrás.",
    tag: "BIENVENIDOS A SU PRÓXIMA PAUSA.",
    cta: "Vending para mi hotel",
    selection: "Bebidas · Café · Snacks",
  },
]

export function EnvironmentStory() {
  const { ref, active, select, scrollDriven } = useScrollChapters(spaces.length)
  const space = spaces[active]
  const Icon = space.icon
  return (
    <section
      ref={ref}
      id="espacios"
      className="environment-experience"
      data-environment={space.id}
      aria-labelledby="environment-title"
    >
      <div className="environment-sticky">
        <div className="environment-heading">
          <div>
            <span className="public-eyebrow">UN MISMO SERVICIO. MUCHAS FORMAS DE VIVIRLO.</span>
            <h2 id="environment-title">
              Tu espacio.
              <br />
              <span>Otra energía.</span>
            </h2>
          </div>
          <div className="environment-choices" role="group" aria-label="Elige un tipo de espacio">
            {spaces.map((item, index) => {
              const SpaceIcon = item.icon
              return (
                <button key={item.id} type="button" aria-pressed={active === index} onClick={() => select(index)}>
                  <SpaceIcon size={16} />
                  {item.name}
                </button>
              )
            })}
          </div>
        </div>
        <div className="environment-layout">
          <div className="environment-room">
            {spaces.map((item, index) => (
              <picture
                key={item.id}
                className={`environment-photo ${index === active ? "is-active" : ""}`}
                aria-hidden={index !== active}
              >
                <source media="(max-width: 767px)" srcSet={`/images/spaces/${item.image}-960.webp`} />
                <Image
                  src={`/images/spaces/${item.image}-1680.webp`}
                  alt={item.alt}
                  fill
                  sizes="90vw"
                />
              </picture>
            ))}
            <span className="room-corner-label">LIFY / {space.name.toUpperCase()}</span>
            <span className="room-product-label">
              <Icon size={14} />
              {space.selection}
            </span>
            <span className="room-light" aria-hidden="true" />
            <span className="environment-frame" aria-hidden="true" />
          </div>
          <div className="environment-copy">
            {spaces.map((item, index) => (
              <div key={item.id} hidden={index !== active} className="environment-panel">
                <span className="public-eyebrow">
                  0{index + 1} / {item.tag}
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Link href="/#contacto" className="public-text-link">
                  {item.cta}
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            ))}
          </div>
        </div>
        <div className="environment-bottom">
          <span>
            <ArrowDown size={13} />
            {scrollDriven ? "SIGUE BAJANDO. CAMBIA EL ESCENARIO." : "ELIGE UN ESPACIO Y MIRA CÓMO CAMBIA."}
          </span>
          <div className="experience-chapter-progress" aria-hidden="true">
            {spaces.map((item, index) => (
              <span key={item.id} className={index === active ? "is-active" : ""} />
            ))}
          </div>
          <span>0{active + 1} / 03</span>
        </div>
      </div>
    </section>
  )
}
