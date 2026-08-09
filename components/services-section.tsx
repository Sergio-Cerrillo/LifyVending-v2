"use client"

import { Coffee, Droplet, PackageCheck, Wrench, Zap } from "lucide-react"

const services = [
  {
    name: "Vending inteligente",
    description: "Snacks, bebidas y producto fresco con selección adaptada al punto.",
    icon: Zap,
    meta: "Stock + pago + reposición",
  },
  {
    name: "Café profesional",
    description: "Soluciones de café automáticas para oficinas, hoteles y espacios de alto tránsito.",
    icon: Coffee,
    meta: "Grano, limpieza y soporte",
  },
  {
    name: "Agua y frío",
    description: "Bebidas frías, agua y surtido de alta rotación sin gestión interna.",
    icon: Droplet,
    meta: "Siempre disponible",
  },
  {
    name: "Servicio técnico",
    description: "Mantenimiento preventivo, incidencias y seguimiento operativo durante todo el año.",
    icon: Wrench,
    meta: "Respuesta priorizada",
  },
]

export function ServicesSection() {
  return (
    <section id="servicios" className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 glass rounded-full border border-primary/10 px-5 py-3">
              <PackageCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-black text-primary">Soluciones operativas</span>
            </div>
            <h2 className="text-[clamp(3rem,10vw,7rem)] font-black leading-[0.88] tracking-[-0.065em] text-foreground">
              Instalamos. Medimos. Reponemos.
            </h2>
          </div>
          <p className="max-w-2xl text-lg font-semibold leading-8 text-muted-foreground sm:text-xl">
            Una máquina vending premium no es solo producto. Es disponibilidad, surtido, mantenimiento y datos trabajando juntos para que el servicio parezca invisible.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1fr_0.82fr] lg:gap-8">
          <div className="divide-y divide-border overflow-hidden rounded-[2rem] border border-border bg-white/70 shadow-xl shadow-emerald-950/5 backdrop-blur-xl">
            {services.map((service, index) => {
              const Icon = service.icon
              return (
                <div
                  key={service.name}
                  className="group grid gap-5 p-6 transition duration-500 hover:bg-white sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-8"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition duration-500 group-hover:scale-105 group-hover:bg-primary group-hover:text-white">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black tracking-[-0.045em] text-foreground sm:text-4xl">{service.name}</h3>
                    <p className="mt-2 max-w-2xl text-base font-semibold leading-7 text-muted-foreground">{service.description}</p>
                  </div>
                  <div className="w-fit rounded-full border border-primary/10 bg-primary/5 px-4 py-2 text-sm font-black text-primary">
                    {service.meta}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-6 text-white shadow-2xl shadow-zinc-950/20 sm:p-8">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">Lify OS</p>
            <h3 className="mt-4 text-5xl font-black leading-[0.9] tracking-[-0.055em] sm:text-6xl">
              Stock vivo para decidir rápido.
            </h3>
            <div className="mt-10 space-y-4">
              {[
                ["Máquinas monitorizadas", "69"],
                ["Unidades a reponer", "6.912"],
                ["Prioridad alta", "14"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-white/6 p-4">
                  <span className="text-sm font-bold text-zinc-300">{label}</span>
                  <span className="text-2xl font-black text-primary">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[78%] rounded-full bg-primary" />
            </div>
            <p className="mt-3 text-sm font-bold text-zinc-400">Reposición optimizada por estado de stock.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
