"use client"

export function CatalogoHero() {
  return (
    <section className="relative pt-24 sm:pt-28 lg:pt-32 pb-8 sm:pb-10 lg:pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight relative">
            <span className="absolute inset-0 blur-3xl bg-primary/30 transform scale-110"></span>
            <span className="relative block bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Catálogo de Productos
            </span>
          </h1>
        </div>
      </div>
    </section>
  )
}
