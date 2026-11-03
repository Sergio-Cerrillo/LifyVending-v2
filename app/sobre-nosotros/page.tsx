import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Plus } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { PublicMotion, ScrollProgress, ScrollReveal, ScrollStatement } from "@/components/public-scroll-effects"
import "../public-site.css"

export const metadata: Metadata = {
  title: "Nosotros | Lify Vending",
  description:
    "Más de 25 años de experiencia en vending. Instalación, gestión y servicio técnico de máquinas vending desde Mallorca.",
}

const values = [
  {
    title: "Seriedad.",
    text: "Hacemos lo que decimos. Actuamos con profesionalidad y responsabilidad en cada instalación, cada reposición y cada conversación.",
  },
  {
    title: "Compromiso.",
    text: "Tu espacio también es un poco nuestro. Nos implicamos para que las máquinas y los productos respondan a lo que tu gente necesita.",
  },
  {
    title: "Dedicación.",
    text: "El buen servicio está en los detalles. En escuchar, en estar cerca y en mejorar el surtido para acompañarte todos los días.",
  },
]
const faqs = [
  {
    question: "¿Cuesta dinero instalar una máquina de vending o café?",
    answer:
      "No requiere inversión inicial para ti. Lify aporta la máquina y gestiona el servicio. Antes de instalarla acordamos la comisión que recibirás según la propuesta para tu espacio.",
  },
  {
    question: "¿Cómo se acuerda mi comisión?",
    answer:
      "El porcentaje se acuerda antes de la instalación y se ajusta a las máquinas y al servicio propuestos. Te explicamos las condiciones de tu espacio para que sepas cómo funciona desde el principio.",
  },
  {
    question: "¿Qué ocurre con los permisos de instalación?",
    answer:
      "Estudiamos las necesidades de cada ubicación y nos encargamos de gestionar los permisos que correspondan a la instalación. Te explicamos todos los detalles al preparar tu propuesta.",
  },
  {
    question: "¿Puedo contrataros solo como servicio técnico?",
    answer:
      "Sí. Ofrecemos mantenimiento y reparación de máquinas de vending como servicio técnico independiente, aunque no tengas contratada nuestra gestión de vending. Cuéntanos qué máquina tienes y qué necesitas para valorar la intervención.",
  },
  {
    question: "¿Quién mantiene las máquinas y repone los productos?",
    answer:
      "Nosotros. Lify se encarga de suministrar las máquinas, reponer los productos y realizar el mantenimiento. El software integrado nos permite conocer el estado del stock para preparar cada reposición.",
  },
]

export default function SobreNosotros() {
  return (
    <main className="public-site">
      <PublicMotion />
      <ScrollProgress />
      <Navigation />
      <section className="public-subhero about-hero">
        <span className="public-eyebrow">SOMOS LIFY / VENDING CON PERSONAS DETRÁS</span>
        <h1>
          Cercanos por
          <br />
          <span>naturaleza.</span>
        </h1>
        <div className="subhero-bottom">
          <p>
            La experiencia de siempre.
            <br />
            Las ganas de hacerlo diferente.
          </p>
          <span className="about-location public-eyebrow">
            <span className="status-dot" />
            MALLORCA, ISLAS BALEARES
          </span>
        </div>
        <span className="about-asterisk" aria-hidden="true">
          ✳
        </span>
      </section>
      <section className="about-story public-section">
        <ScrollReveal>
          <div className="section-kicker">
            <span className="public-eyebrow">NUESTRA HISTORIA</span>
            <span className="mini-asterisk">✳</span>
          </div>
        </ScrollReveal>
        <ScrollStatement text="Después de más de 25 años en el mundo del vending, decidimos crear algo propio. Una forma de trabajar más cercana. Más nuestra. Más Lify." />
        <div className="about-story-bottom">
          <ScrollReveal className="about-experience">
            <span>
              25<span>+</span>
            </span>
            <p>
              AÑOS DE EXPERIENCIA
              <br />
              EN EL SECTOR DEL VENDING
            </p>
          </ScrollReveal>
          <ScrollReveal className="about-story-copy">
            <p>
              Lify Vending nace de la experiencia en el sector de las máquinas dispensadoras y de una idea muy clara:
              dar un gran servicio sin perder la transparencia y la cercanía.
            </p>
            <p>
              Seriedad, compromiso y dedicación. Es nuestra forma de entender el trabajo y de cuidar cada espacio que
              confía en nosotros.
            </p>
            <p>
              También estamos instalando máquinas en zonas deportivas, llevando ese mismo cuidado a las pausas de
              quienes entrenan, compiten o acompañan.
            </p>
            <p>
              Además, somos servicio técnico de máquinas de vending. Puedes contar con nosotros para el mantenimiento y
              la reparación, como un servicio independiente de la gestión de tus máquinas.
            </p>
            <Link href="/#contacto" className="public-text-link">
              Conozcámonos <ArrowUpRight size={20} />
            </Link>
          </ScrollReveal>
        </div>
      </section>
      <section className="about-values public-section">
        <ScrollReveal>
          <span className="public-eyebrow">LO QUE NOS MUEVE</span>
          <h2>
            El servicio empieza
            <br />
            <span>por las personas.</span>
          </h2>
        </ScrollReveal>
        <div className="values-grid">
          {values.map((value, i) => (
            <ScrollReveal key={value.title} delay={i * 70}>
              <span className="value-index">0{i + 1} /</span>
              <h3>{value.title}</h3>
              <p>{value.text}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>
      <section className="public-faq public-section">
        <ScrollReveal className="faq-heading">
          <span className="public-eyebrow">SIN DUDAS. SIN COMPLICACIONES.</span>
          <h2>
            Nos lo
            <br />
            <span>preguntáis mucho.</span>
          </h2>
        </ScrollReveal>
        <div className="faq-list">
          {faqs.map((faq, i) => (
            <ScrollReveal key={faq.question}>
              <details>
                <summary>
                  <span>0{i + 1}</span>
                  <h3>{faq.question}</h3>
                  <Plus size={22} strokeWidth={1.5} />
                </summary>
                <p>{faq.answer}</p>
              </details>
            </ScrollReveal>
          ))}
        </div>
      </section>
      <section className="about-final public-section">
        <ScrollReveal>
          <h2>
            Ahora solo
            <br />
            faltas <span>tú.</span>
          </h2>
          <Link href="/#contacto" className="public-button light">
            Hablemos de tu espacio <ArrowUpRight size={20} />
          </Link>
        </ScrollReveal>
      </section>
      <Footer />
    </main>
  )
}
