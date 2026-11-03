import Image from "next/image"
import companyLogo from "@/public/logo.png"
import Link from "next/link"
import { ArrowUpRight, ArrowUp, MapPin } from "lucide-react"

const mapAddress = encodeURIComponent("Calle Mozart 10A, Mallorca, Islas Baleares, España")
const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapAddress}`

export function Footer() {
  return (
    <footer className="public-footer">
      <div className="footer-top">
        <Link href="/" className="public-brand" aria-label="Lify Vending, inicio">
          <span className="brand-original">
            <Image src={companyLogo} alt="" sizes="124px" />
          </span>
          <span className="brand-caption">
            BUENAS PAUSAS.
            <br />
            MEJORES DÍAS.
          </span>
        </Link>
        <div className="footer-links">
          <Link href="/sobre-nosotros">Nosotros</Link>
          <Link href="/catalogo">Catálogo</Link>
          <Link href="/servicio-tecnico">Servicio técnico</Link>
          <a href="https://www.instagram.com/lify.vending" target="_blank" rel="noopener noreferrer">
            Instagram
            <ArrowUpRight size={14} />
          </a>
          <Link href="/login">
            Área privada
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <a href="#" className="back-to-top" aria-label="Volver al principio">
          <ArrowUp size={20} />
        </a>
      </div>
      <div className="footer-location">
        <div className="footer-location-copy">
          <span className="public-eyebrow">ENCUÉNTRANOS / ISLAS BALEARES</span>
          <h2>
            Desde Mallorca.
            <br />
            <span>Muy cerca de ti.</span>
          </h2>
          <address>
            <MapPin size={19} strokeWidth={1.5} aria-hidden="true" />
            <span>
              Calle Mozart, Local 10A
              <br />
              Islas Baleares, España
            </span>
          </address>
          <a href={directionsUrl} className="public-text-link" target="_blank" rel="noopener noreferrer">
            Cómo llegar <ArrowUpRight size={19} />
          </a>
        </div>
        <div className="footer-map">
          <iframe
            title="Ubicación de Lify Vending: Calle Mozart, Local 10A, Islas Baleares"
            src={`https://maps.google.com/maps?q=${mapAddress}&z=16&output=embed`}
            width="600"
            height="320"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
      <a href="https://scwebstudio.tech" target="_blank" rel="noopener noreferrer" className="studio-credit">
        <div className="studio-signature">
          <span className="public-eyebrow">DISEÑO Y DESARROLLO DE ESTA WEB</span>
          <Image src="/logo-full-w.png" alt="SCWebStudio" width={330} height={93} />
        </div>
        <span className="studio-visit">
          Conoce el estudio{" "}
          <span>
            <ArrowUpRight size={23} />
          </span>
        </span>
      </a>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Lify Vending</p>
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
          Calle Mozart, Local 10A · Islas Baleares
        </a>
      </div>
    </footer>
  )
}
