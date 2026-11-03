import { ArrowUpRight, Mail, Phone, Wrench } from "lucide-react"
import { ScrollReveal } from "@/components/public-scroll-effects"

export function CallToAction() {
  return (
    <section id="contacto" className="public-contact public-section" aria-labelledby="contact-title">
      <ScrollReveal>
        <div className="section-kicker">
          <span className="public-eyebrow">05 / LAS BUENAS IDEAS EMPIEZAN HABLANDO</span>
          <span className="contact-asterisk">✳</span>
        </div>
      </ScrollReveal>
      <ScrollReveal>
        <h2 id="contact-title">
          ¿Hacemos
          <br />
          <span>una pausa?</span>
          <ArrowUpRight className="contact-arrow" strokeWidth={1} />
        </h2>
      </ScrollReveal>
      <ScrollReveal className="contact-bottom">
        <div className="contact-intro">
          <p>
            Cuéntanos cómo es tu espacio o qué necesita tu máquina.
            <br />
            Te ayudamos con vending y servicio técnico.
          </p>
          <a
            href="https://wa.me/34692129851?text=Hola%2C%20necesito%20servicio%20t%C3%A9cnico%20para%20una%20m%C3%A1quina%20de%20vending.%20Quiero%20consultar%20una%20reparaci%C3%B3n%20o%20mantenimiento."
            target="_blank"
            rel="noopener noreferrer"
            className="contact-technical-link"
          >
            <Wrench size={16} aria-hidden="true" />
            Consultar servicio técnico
            <ArrowUpRight size={16} />
          </a>
        </div>
        <a
          href="https://wa.me/34692129851?text=Hola%2C%20quiero%20estudiar%20una%20propuesta%20de%20vending%20para%20mi%20espacio."
          target="_blank"
          rel="noopener noreferrer"
          className="public-button light"
        >
          Hablemos por WhatsApp <ArrowUpRight size={21} />
        </a>
      </ScrollReveal>
      <ScrollReveal className="contact-direct">
        <a href="mailto:info@lifyvending.com">
          <Mail size={17} />
          info@lifyvending.com
          <ArrowUpRight size={15} />
        </a>
        <a href="tel:+34692129851">
          <Phone size={17} />
          (+34) 692 12 98 51
          <ArrowUpRight size={15} />
        </a>
        <span>
          <span className="status-dot" />
          Desde Mallorca. Todo el año.
        </span>
      </ScrollReveal>
    </section>
  )
}
