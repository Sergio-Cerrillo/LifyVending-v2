import type { Metadata } from "next"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { CatalogoHero } from "@/components/catalogo-hero"
import { ProductosGrid } from "@/components/productos-grid"
import { PublicMotion, ScrollProgress } from "@/components/public-scroll-effects"
import "../public-site.css"
import "../catalog-portal.css"

export const metadata: Metadata = {
  title: "Catálogo | Lify Vending",
  description: "Café, snacks, bebidas y productos para tu espacio. Descubre la selección de Lify Vending en Mallorca.",
}

export default function CatalogPage() {
  return (
    <main className="public-site">
      <PublicMotion />
      <ScrollProgress />
      <Navigation />
      <CatalogoHero />
      <ProductosGrid />
      <Footer />
    </main>
  )
}
