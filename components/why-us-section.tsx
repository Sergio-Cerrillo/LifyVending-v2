"use client"

import { Award, CheckCircle2, Shield, Target, TrendingUp, Zap } from "lucide-react"

const stats = [
  { value: "0€", label: "inversión para el cliente" },
  { value: "24/7", label: "operación y soporte" },
  { value: "70+", label: "espacios gestionados" },
  { value: "Datos", label: "para cada reposición" },
]

const process = [
  {
    icon: Target,
    title: "Estudiamos",
    description: "Analizamos el espacio, flujo de personas y consumo esperado antes de proponer máquina.",
  },
  {
    icon: Zap,
    title: "Instalamos",
    description: "Colocamos la solución completa, con producto, pagos y configuración operativa.",
  },
  {
    icon: TrendingUp,
    title: "Optimizamos",
    description: "Ajustamos surtido, ruta y reposición según rotación real y estado de stock.",
  },
]

export function WhyUsSection() {
  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <p className="max-w-2xl text-lg font-semibold leading-8 text-muted-foreground sm:text-xl lg:pb-4">
            Nos ocupamos del servicio completo: producto, incidencias, reposición, mantenimiento y lectura de datos. El cliente ve resultados; no tareas.
          </p>
          <div className="lg:text-right">
            <div className="mb-5 inline-flex items-center gap-2 glass rounded-full border border-primary/10 px-5 py-3 lg:ml-auto">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-black text-primary">Por qué Lify</span>
            </div>
            <h2 className="text-[clamp(3rem,10vw,7rem)] font-black leading-[0.88] tracking-[-0.065em] text-foreground">
              Premium es que todo funcione.
            </h2>
          </div>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[1.5rem] border border-border bg-white/75 p-6 shadow-sm backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10">
              <p className="text-5xl font-black tracking-[-0.055em] text-primary sm:text-6xl">{stat.value}</p>
              <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {process.map((item, index) => {
            const Icon = item.icon
            return (
              <article key={item.title} className="group rounded-[1.75rem] border border-border bg-white/70 p-7 shadow-sm backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-emerald-950/10">
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl bg-primary/10 text-primary transition duration-500 group-hover:bg-primary group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-black text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="text-3xl font-black tracking-[-0.045em] text-foreground">{item.title}</h3>
                <p className="mt-4 text-base font-semibold leading-7 text-muted-foreground">{item.description}</p>
              </article>
            )
          })}
        </div>

        <div className="mt-8 rounded-[2rem] border border-primary/10 bg-primary/5 p-6 sm:p-8">
          <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
              <Shield className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-[-0.04em] text-foreground">Sin inversión. Sin mantenimiento. Sin fricción.</h3>
              <p className="mt-2 text-base font-semibold leading-7 text-muted-foreground">Una propuesta pensada para que el espacio gane servicio desde el primer día.</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-black text-primary">
              <CheckCircle2 className="h-5 w-5" />
              Operación incluida
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
