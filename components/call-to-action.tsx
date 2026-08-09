"use client"

import { ArrowRight, Clock, Mail, Phone } from "lucide-react"

export function CallToAction() {
  return (
    <section id="contacto" className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2.25rem] bg-zinc-950 p-6 text-white shadow-2xl shadow-zinc-950/20 sm:p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm font-black text-primary">Empezamos cuando quieras</span>
              </div>
              <h2 className="text-[clamp(3rem,10vw,7.3rem)] font-black leading-[0.86] tracking-[-0.07em]">
                Cuéntanos tu espacio.
              </h2>
              <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-zinc-300 sm:text-xl">
                Te diremos qué máquina encaja, qué surtido tendría sentido y cómo operarlo sin inversión inicial para ti.
              </p>
            </div>

            <div className="space-y-3">
              <a
                href="https://wa.me/34692129851?text=Hola%2C%20quiero%20estudiar%20una%20propuesta%20de%20vending%20para%20mi%20espacio."
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 items-center justify-between rounded-full bg-primary px-6 text-base font-black text-white shadow-xl shadow-primary/20 transition hover:-translate-y-1 hover:bg-primary/90"
              >
                WhatsApp directo
                <ArrowRight className="h-5 w-5" />
              </a>
              <a
                href="mailto:info@lifyvending.com"
                className="flex h-14 items-center justify-between rounded-full border border-white/15 bg-white/5 px-6 text-base font-black text-white transition hover:-translate-y-1 hover:bg-white hover:text-zinc-950"
              >
                info@lifyvending.com
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="mt-10 grid gap-3 border-t border-white/10 pt-8 sm:grid-cols-3">
            {[
              { icon: Phone, label: "Teléfono", value: "(+34) 692 12 98 51" },
              { icon: Mail, label: "Email", value: "info@lifyvending.com" },
              { icon: Clock, label: "Servicio", value: "Operación todo el año" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-2xl bg-white/5 p-5">
                  <Icon className="mb-4 h-6 w-6 text-primary" />
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
                  <p className="mt-2 text-base font-black text-zinc-100">{item.value}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
