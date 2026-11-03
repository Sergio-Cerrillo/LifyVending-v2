import { ArrowDownRight, ArrowUpRight, Check } from "lucide-react"
import Link from "next/link"
import { ScrollReveal } from "@/components/public-scroll-effects"

const steps = [
  {
    title: "Nos cuentas.",
    text: "Cada espacio tiene su ritmo. Estudiamos tu ubicación, las personas y sus necesidades para encontrar la solución que encaja contigo.",
    tag: "ESCUCHAR ANTES QUE INSTALAR",
  },
  {
    title: "Lo hacemos realidad.",
    text: "Instalamos las máquinas y preparamos el surtido. Nos encargamos de los detalles para que tú no tengas que empezar de cero.",
    tag: "TODO LISTO PARA LA PRIMERA PAUSA",
  },
  {
    title: "Siempre estamos.",
    text: "Reponemos, mantenemos y ajustamos los productos según el consumo real. Tu servicio sigue funcionando. Tú recibes tu comisión.",
    tag: "UN EQUIPO DETRÁS DE CADA MÁQUINA",
  },
]

export function WhyUsSection() {
  return (
    <>
      <section className="public-zero public-section" data-scene="hero" aria-labelledby="zero-title">
        <ScrollReveal>
          <span className="public-eyebrow">03 / ASÍ DE FÁCIL. ASÍ DE LIFY.</span>
        </ScrollReveal>
        <div className="zero-layout">
          <ScrollReveal className="zero-figure">
            <span>0</span>
            <span>€</span>
            <div className="zero-orbit" />
          </ScrollReveal>
          <ScrollReveal className="zero-copy">
            <h2 id="zero-title">
              Tú pones
              <br />
              el espacio.
              <br />
              <span>
                Nosotros, todo
                <br />
                lo demás.
              </span>
            </h2>
            <p>
              Sin inversión inicial. Con instalación, mantenimiento y reposición incluidos. El valor de un servicio
              completo, sin añadir tareas a tu día.
            </p>
            <Link href="/#contacto" className="public-button">
              Quiero saber más <ArrowUpRight size={20} />
            </Link>
          </ScrollReveal>
        </div>
        <div className="zero-foot">
          <span>
            <Check size={16} />
            Sin inversión
          </span>
          <span>
            <Check size={16} />
            Mantenimiento incluido
          </span>
          <span>
            <Check size={16} />
            Reposición inteligente
          </span>
        </div>
      </section>
      <section className="public-process public-section" aria-labelledby="process-title">
        <div className="process-heading">
          <span className="public-eyebrow">04 / DE TU IDEA A TU PRIMER CAFÉ</span>
          <h2 id="process-title">
            Las cosas
            <br />
            buenas,
            <br />
            <span>sin líos.</span>
          </h2>
          <ArrowDownRight className="process-arrow" strokeWidth={1} />
          <p>
            Un solo equipo.
            <br />
            Todo el camino contigo.
          </p>
        </div>
        <div className="process-steps">
          {steps.map((step, i) => (
            <ScrollReveal key={step.title} className="process-step">
              <span className="step-number">0{i + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <span className="public-eyebrow">{step.tag}</span>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>
    </>
  )
}
