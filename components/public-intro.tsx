import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { ScrollReveal, ScrollStatement } from "@/components/public-scroll-effects"

export function PublicIntro() {
  return (
    <>
      <div className="public-marquee" aria-label="Buenas pausas. Mejores días. Cero complicaciones.">
        <div aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i}>
              BUENAS PAUSAS <span>✳</span> MEJORES DÍAS <span>✳</span> CERO COMPLICACIONES <span>✳</span>{" "}
            </span>
          ))}
        </div>
      </div>
      <section id="descubre" className="public-intro public-section">
        <ScrollReveal>
          <div className="section-kicker">
            <span className="public-eyebrow">01 / LA FILOSOFÍA LIFY</span>
            <span className="mini-asterisk">✳</span>
          </div>
        </ScrollReveal>
        <ScrollStatement text="Creemos en esas pequeñas pausas que hacen grandes tus días. Un café. Algo rico. Un momento para recargar." />
        <ScrollReveal className="intro-bottom">
          <p>
            Nos encargamos de las máquinas, los productos y de que todo funcione. Tú disfrutas de un mejor servicio en
            tu espacio y recibes tu comisión.
          </p>
          <Link href="/sobre-nosotros" className="public-text-link">
            Así somos en Lify <ArrowUpRight size={20} />
          </Link>
        </ScrollReveal>
      </section>
    </>
  )
}
