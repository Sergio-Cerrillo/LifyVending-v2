"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Image from "next/image"
import { ArrowDown, ArrowUpRight, Layers3, RotateCcw } from "lucide-react"
import { useScrollChapters } from "@/components/experience-motion"
import { useExplodedMotion } from "@/components/use-exploded-motion"

const parts = [
  {
    id: "diagnosis",
    name: "Diagnóstico",
    title: "Entender lo que ocurre.",
    text: "La marca, el modelo y el síntoma nos ayudan a empezar. Estudiamos contigo la incidencia para valorar qué intervención necesita tu máquina.",
  },
  {
    id: "mechanisms",
    name: "Dispensación",
    title: "Cada selección cuenta.",
    text: "Un producto que no sale o una selección que no responde. Cuéntanos qué falla para valorar el trabajo de reparación según tu máquina.",
  },
  {
    id: "maintenance",
    name: "Refrigeración",
    title: "La temperatura también cuenta.",
    text: "Si tu máquina no enfría como debería, cuéntanos qué ocurre. Valoramos la incidencia y las necesidades de mantenimiento según el modelo y su estado.",
  },
  {
    id: "repair",
    name: "Selección y pago",
    title: "Que tu elección responda.",
    text: "La pantalla, las selecciones y el sistema de pago forman parte de la experiencia. Explícanos qué deja de funcionar para estudiar la intervención que necesita.",
  },
  {
    id: "access",
    name: "Acceso y puerta",
    title: "Abrir para entender.",
    text: "Acceder al interior permite valorar el estado de la máquina y sus mecanismos. Concretamos contigo las tareas de revisión o reparación que necesite.",
  },
  {
    id: "structure",
    name: "Estructura",
    title: "Cuidar el conjunto.",
    text: "Una máquina es más que sus componentes. Revisamos tus necesidades y valoramos cada caso, también si solo quieres contratar el servicio técnico.",
  },
]

// The supplied PNGs were positioned approximately, so each piece needs a mounting
// calibration inside the cabinet before the outer layer can animate away from it.
const layers = [
  {
    file: "01-carcasa",
    part: "structure",
    className: "part-shell",
    x: 0,
    y: 0,
    start: 0,
    end: 1,
    fitX: 0,
    fitY: 0,
    fitScaleX: 1,
    fitScaleY: 1,
    origin: "50% 50%",
  },
  {
    file: "06-electronica",
    part: "diagnosis",
    className: "part-electronics",
    x: 17,
    y: -2,
    start: 0.25,
    end: 1,
    fitX: -65,
    fitY: 0,
    fitScaleX: 0.85,
    fitScaleY: 0.85,
    origin: "54.2% 49.5%",
  },
  {
    file: "05-frio",
    part: "maintenance",
    className: "part-base",
    x: 18,
    y: 7,
    start: 0.32,
    end: 1,
    fitX: 0,
    fitY: -140,
    fitScaleX: 0.7,
    fitScaleY: 0.7,
    origin: "48.83% 82.03%",
  },
  {
    file: "03-bandejas",
    part: "mechanisms",
    className: "part-trays",
    x: -4,
    y: -2,
    start: 0.1,
    end: 0.86,
    fitX: 0,
    fitY: 60,
    fitScaleX: 0.9,
    fitScaleY: 0.8,
    origin: "43.95% 25.65%",
  },
  {
    file: "04-pago",
    part: "repair",
    className: "part-controls",
    x: 19,
    y: -3,
    start: 0.2,
    end: 0.94,
    fitX: -65,
    fitY: 60,
    fitScaleX: 0.85,
    fitScaleY: 1,
    origin: "59.67% 36.4%",
  },
  {
    file: "02-puerta",
    part: "access",
    className: "part-door",
    x: -23,
    y: 0,
    start: 0,
    end: 0.9,
    fitX: 0,
    fitY: -25,
    fitScaleX: 1.2,
    fitScaleY: 1.04,
    origin: "34.23% 28.125%",
  },
]

function ExplodedDrawing({ active }: { active: string }) {
  return (
    <div className="exploded-machine photo-machine" aria-hidden="true">
      <span className="exploded-ground" />
      <div className="exploded-photo-canvas">
        {layers.map((layer) => (
          <div
            key={layer.file}
            className={`exploded-part exploded-photo-layer ${layer.className}`}
            data-selected={active === layer.part}
            style={
              {
                "--layer-x": `${layer.x}%`,
                "--layer-y": `${layer.y}%`,
                "--fit-x": `${(layer.fitX / 2048) * 100}%`,
                "--fit-y": `${(layer.fitY / 1536) * 100}%`,
                "--fit-scale-x": layer.fitScaleX,
                "--fit-scale-y": layer.fitScaleY,
                "--fit-origin": layer.origin,
              } as CSSProperties
            }
          >
            <div className="exploded-registration">
              <Image src={`/images/technical/${layer.file}.webp`} alt="" fill sizes="(max-width: 767px) 120vw, 70vw" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TechnicalExploded() {
  const { ref, active, select, scrollDriven } = useScrollChapters(parts.length, 800)
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const selectorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const list = selectorRef.current
    const selected = list?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!list || !selected) return
    const revealSelection = () => {
      if (list.scrollWidth <= list.clientWidth) return
      list.scrollTo({
        left: selected.offsetLeft + selected.offsetWidth / 2 - list.clientWidth / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      })
    }
    const observer = new ResizeObserver(revealSelection)
    observer.observe(list)
    revealSelection()
    return () => observer.disconnect()
  }, [active])
  useExplodedMotion(ref, stageRef, layers, manualOpen, scrollDriven)
  const selectPart = (index: number) => {
    if (!scrollDriven || manualOpen === false) setManualOpen(true)
    select(index)
  }
  return (
    <section
      ref={ref}
      id="por-dentro"
      className="technical-exploded"
      data-visual="photographic"
      aria-labelledby="exploded-title"
    >
      <div className="exploded-sticky">
        <div className="experience-heading exploded-heading">
          <div>
            <span className="public-eyebrow">UNA MIRADA AL INTERIOR DE TU VENDING</span>
            <h2 id="exploded-title">
              Por dentro.
              <br />
              <span>De tu lado.</span>
            </h2>
          </div>
          <p>
            Explora cada componente.
            <br />
            Conoce el equipo que puede cuidarla.
          </p>
        </div>
        <div className="exploded-layout">
          <div className="exploded-visual">
            <div
              ref={stageRef}
              className="exploded-stage"
              data-part={parts[active].id}
              data-manual={manualOpen !== null}
            >
              <span className="exploded-stage-label public-eyebrow">LIFY / SERVICE INSIDE</span>
              <ExplodedDrawing active={parts[active].id} />
            </div>
            <div className="exploded-view-controls">
              <button type="button" aria-pressed={manualOpen === false} onClick={() => setManualOpen(false)}>
                Ver máquina montada
              </button>
              <button type="button" aria-pressed={manualOpen === true} onClick={() => setManualOpen(true)}>
                <Layers3 size={15} />
                Ver despiece
              </button>
              {manualOpen !== null && scrollDriven && (
                <button
                  type="button"
                  onClick={() => setManualOpen(null)}
                  aria-label="Volver a la exploración con scroll"
                >
                  <RotateCcw size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="exploded-copy">
            <div
              ref={selectorRef}
              className="technical-part-controls"
              role="group"
              aria-label="Explora nuestra labor técnica"
            >
              {parts.map((part, index) => (
                <button
                  key={part.id}
                  type="button"
                  aria-label={`Explorar ${part.name.toLowerCase()}`}
                  aria-pressed={active === index}
                  aria-controls={`part-${part.id}`}
                  onClick={() => selectPart(index)}
                >
                  {part.name}
                  <ArrowUpRight size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
            {parts.map((part, index) => (
              <div key={part.id} id={`part-${part.id}`} className="exploded-detail" hidden={active !== index}>
                <span className="public-eyebrow">{part.name.toUpperCase()}</span>
                <h3>{part.title}</h3>
                <p>{part.text}</p>
              </div>
            ))}
            <a href="#asistencia" className="public-text-link">
              Hablemos de tu máquina
              <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
        <div className="exploded-bottom">
          <span>
            <ArrowDown size={13} />
            {scrollDriven ? "SIGUE BAJANDO O ELIGE UN COMPONENTE." : "ELIGE UN COMPONENTE PARA EXPLORAR."}
          </span>
          <p>Ilustración orientativa. Valoramos cada máquina y cada intervención contigo.</p>
        </div>
      </div>
    </section>
  )
}
