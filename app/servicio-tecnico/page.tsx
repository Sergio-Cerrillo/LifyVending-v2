import type { Metadata } from "next"
import Image from "next/image"
import { ArrowUpRight, Mail, Phone, Plus, Settings2, Wrench, Handshake } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { TechnicalExploded } from "@/components/technical-exploded"
import { PublicMotion, ScrollProgress, ScrollReveal } from "@/components/public-scroll-effects"
import "../public-site.css"
import "../experiences.css"
import "../brand-scenes.css"
import "../technical-layers.css"

export const metadata: Metadata = {
  title: "Servicio técnico de vending en Mallorca | Lify Vending",
  description:
    "Servicio técnico de máquinas de vending en Mallorca. Mantenimiento y reparación con Lify, también sin contratar la gestión de tus máquinas. Consulta tu caso.",
}

const assistanceUrl = `https://wa.me/34692129851?text=${encodeURIComponent("Hola, necesito servicio técnico para una máquina de vending. Quiero consultar una reparación o mantenimiento.")}`

const services = [
  {
    title: "Mantenimiento.",
    icon: Settings2,
    text: "Cuidar una máquina también es cuidar el servicio que ofrece. Revisamos tus necesidades y valoramos las tareas de mantenimiento para su funcionamiento.",
  },
  {
    title: "Reparación.",
    icon: Wrench,
    text: "Si tu máquina presenta un fallo, cuéntanos qué ocurre. Estudiamos la incidencia y te orientamos sobre la intervención que necesita.",
  },
  {
    title: "Por separado.",
    icon: Handshake,
    text: "Puedes contar con Lify como servicio técnico aunque no tengas contratada nuestra gestión de vending. Consúltanos tu caso y vemos cómo ayudarte.",
  },
]

const steps = [
  {
    title: "Cuéntanos qué ocurre.",
    text: "Indícanos la marca y el modelo de la máquina, dónde está y qué problema presenta. Si puedes, acompáñalo de una foto o un vídeo por WhatsApp.",
    tag: "EL PRIMER PASO: ENTENDER TU MÁQUINA",
  },
  {
    title: "Valoramos tu caso.",
    text: "Revisamos la información y hablamos contigo para concretar qué necesitas. Te explicamos cómo podemos ayudarte y los siguientes pasos.",
    tag: "CADA MÁQUINA, SU SOLUCIÓN",
  },
  {
    title: "Coordinamos contigo.",
    text: "Concretamos los detalles de la intervención para organizar el trabajo de mantenimiento o reparación que hayamos acordado.",
    tag: "UN EQUIPO CON EL QUE HABLAR",
  },
]

const faqs = [
  {
    question: "¿Puedo solicitar solo el servicio técnico?",
    answer:
      "Sí. El mantenimiento y la reparación se pueden consultar como un servicio independiente. No necesitas contratar la gestión completa de vending con Lify.",
  },
  {
    question: "¿Qué información necesitáis para valorar mi máquina?",
    answer:
      "La marca, el modelo, la ubicación y una descripción del problema o del mantenimiento que necesitas. Una foto o un vídeo nos ayudan a entender mejor la situación.",
  },
  {
    question: "¿Podéis intervenir en mi máquina?",
    answer:
      "Cuéntanos qué máquina tienes y qué necesita. Valoramos cada caso contigo para concretar si podemos intervenir y el alcance del servicio.",
  },
]

export default function TechnicalServicePage() {
  return (
    <main className="public-site technical-page">
      <PublicMotion />
      <ScrollProgress />
      <Navigation />
      <section className="public-subhero technical-hero" data-scene="technical" aria-labelledby="technical-hero-title">
        <div className="technical-hero-media">
          <picture>
            <source media="(max-width: 767px)" srcSet="/images/spaces/servicio-tecnico-mobile.webp" />
            <Image
              src="/images/spaces/servicio-tecnico-1680.webp"
              alt="Visualización del interior de una máquina Lify abierta para su mantenimiento."
              fill
              priority
              sizes="100vw"
            />
          </picture>
        </div>
        <div className="technical-hero-content">
          <span className="public-eyebrow">SERVICIO TÉCNICO DE VENDING / MALLORCA</span>
          <h1 id="technical-hero-title">
            Tu máquina.
            <br />
            <span>En buenas manos.</span>
          </h1>
          <div className="subhero-bottom">
            <p>
              Somos servicio técnico de máquinas de vending.
              <br />
              Mantenimiento y reparación, también como servicio independiente.
            </p>
            <a href="#asistencia" className="public-button">
              Consultar mi máquina <ArrowUpRight size={20} />
            </a>
          </div>
        </div>
        <a href="#por-dentro" className="technical-hero-explore">
          Explora la máquina por dentro <ArrowUpRight size={16} />
        </a>
      </section>
      <TechnicalExploded />
      <section className="about-values technical-overview public-section" aria-labelledby="technical-services-title">
        <ScrollReveal>
          <span className="public-eyebrow">MANTENIMIENTO, REPARACIÓN Y UN EQUIPO DETRÁS</span>
          <h2 id="technical-services-title">
            ¿En qué
            <br />
            <span>te ayudamos?</span>
          </h2>
        </ScrollReveal>
        <div className="values-grid">
          {services.map((service, index) => {
            const Icon = service.icon
            return (
              <ScrollReveal key={service.title} delay={index * 70}>
                <div className="technical-service-icon">
                  <span className="value-index">0{index + 1} /</span>
                  <Icon size={28} strokeWidth={1.4} aria-hidden="true" />
                </div>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
              </ScrollReveal>
            )
          })}
        </div>
      </section>
      <section className="public-process technical-process public-section" aria-labelledby="technical-process-title">
        <div className="process-heading">
          <span className="public-eyebrow">ASÍ SOLICITAS EL SERVICIO</span>
          <h2 id="technical-process-title">
            Lo hablamos.
            <br />
            <span>Lo valoramos.</span>
          </h2>
          <p className="technical-process-intro">
            Una consulta sobre tu máquina.
            <br />
            Un equipo al otro lado.
          </p>
        </div>
        <div className="process-steps">
          {steps.map((step, index) => (
            <ScrollReveal key={step.title} className="process-step">
              <span className="step-number">0{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <span className="public-eyebrow">{step.tag}</span>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>
      <section className="public-faq public-section" aria-labelledby="technical-faq-title">
        <ScrollReveal className="faq-heading">
          <span className="public-eyebrow">ANTES DE EMPEZAR</span>
          <h2 id="technical-faq-title">
            Resolvemos
            <br />
            <span>tus dudas.</span>
          </h2>
        </ScrollReveal>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <ScrollReveal key={faq.question}>
              <details>
                <summary>
                  <span>0{index + 1}</span>
                  <h3>{faq.question}</h3>
                  <Plus size={22} strokeWidth={1.5} />
                </summary>
                <p>{faq.answer}</p>
              </details>
            </ScrollReveal>
          ))}
        </div>
      </section>
      <section
        id="asistencia"
        className="about-final technical-assistance public-section"
        aria-labelledby="technical-contact-title"
      >
        <ScrollReveal>
          <span className="public-eyebrow">HABLEMOS DE TU MÁQUINA</span>
          <h2 id="technical-contact-title">
            ¿Necesitas
            <br />
            <span>servicio técnico?</span>
          </h2>
          <p>
            Cuéntanos qué ocurre o qué mantenimiento buscas.
            <br />
            Valoramos tu caso contigo.
          </p>
          <a href={assistanceUrl} target="_blank" rel="noopener noreferrer" className="public-button light">
            Solicitar asistencia por WhatsApp <ArrowUpRight size={20} />
          </a>
          <div className="technical-contact-links">
            <a href="tel:+34692129851">
              <Phone size={16} />
              (+34) 692 12 98 51
            </a>
            <a href="mailto:info@lifyvending.com?subject=Consulta%20de%20servicio%20t%C3%A9cnico">
              <Mail size={16} />
              info@lifyvending.com
            </a>
          </div>
        </ScrollReveal>
      </section>
      <Footer />
    </main>
  )
}
