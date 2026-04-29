"use client"

import { Mail, Phone, MapPin, Instagram } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export function Footer() {
  return (
    <footer id="contacto" className="relative border-t border-border">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              <span className="text-primary">Contacto</span>
            </h2>
            <p className="text-lg text-muted-foreground font-light">
              Estamos aquí para ayudarte
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <Image
                    src="/logo.png"
                    alt="Lify Vending Logo"
                    width={80}
                    height={80}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-2xl text-primary">Lify Vending</h3>
                  <p className="text-sm text-muted-foreground font-light">Tu negocio sin inversión</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="glass glass-hover rounded-2xl p-6 group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <MapPin className="text-primary" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1 font-light">Dirección</p>
                      <p className="font-semibold text-lg">Calle Mozart, Local 10A</p>
                      <p className="text-muted-foreground font-light">Islas Baleares 07008</p>
                    </div>
                  </div>
                </div>

                <div className="glass glass-hover rounded-2xl p-6 group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Phone className="text-primary" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1 font-light">Teléfono</p>
                      <a href="tel:+34692129851" className="font-semibold text-lg text-primary hover:underline">
                        (+34) 692 12 98 51
                      </a>
                    </div>
                  </div>
                </div>

                <div className="glass glass-hover rounded-2xl p-6 group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Mail className="text-primary" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1 font-light">Email</p>
                      <a href="mailto:info@lifyvending.com" className="font-semibold text-lg text-primary hover:underline">
                        info@lifyvending.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <div className="flex gap-3">
                  <a
                    href="mailto:info@lifyvending.com"
                    className="w-12 h-12 glass glass-hover rounded-xl flex items-center justify-center group"
                  >
                    <Mail size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                  <a
                    href="https://www.instagram.com/lify.vending"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 glass glass-hover rounded-xl flex items-center justify-center group"
                  >
                    <Instagram size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                  <a
                    href="https://wa.me/34692129851"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 glass glass-hover rounded-xl flex items-center justify-center group"
                  >
                    <svg className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl overflow-hidden h-[500px]">
              <iframe
                src="https://www.google.com/maps?q=Calle+Mozart+10A,+07008+Palma,+Baleares,+España&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación Lify Vending"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground font-light">
              © 2026 Lify Vending. Todos los derechos reservados.
            </p>

            <div className="flex items-center gap-6 text-sm font-light">
              {["Privacidad", "Términos", "Cookies"].map((item) => (
                <a key={item} href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  {item}
                </a>
              ))}
            </div>

            <div className="glass px-4 py-2 rounded-full text-xs font-medium">
              <p className="text-muted-foreground text-sm text-center">
                Desarrollado por:
              </p>
              <div className="flex gap-6 text-sm">
                <Link
                  href="https://scwebstudio.tech"
                  className="group transition-opacity hover:opacity-80"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {/* Logo blanco para modo oscuro */}
                  <img
                    src="/logo-full-w.png"
                    alt="SCWebStudio"
                    className="h-20 w-auto hidden dark:block group-hover:scale-105 transition-transform"
                  />
                  {/* Logo oscuro para modo claro */}
                  <img
                    src="/logo-full-b.png"
                    alt="SCWebStudio"
                    className="h-20 w-auto block dark:hidden group-hover:scale-105 transition-transform"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
