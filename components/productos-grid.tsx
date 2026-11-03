import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Plus, Coffee, Droplet, Cookie, Package } from "lucide-react"
import { ScrollReveal } from "@/components/public-scroll-effects"

const categories = [
  {
    id: "snacks",
    name: "Snacks",
    icon: Cookie,
    image: "/images/catalog/snacks.webp",
    alt: "Selección de frutos secos",
    description: "Dulces, salados y opciones para cuidarse. Pequeños bocados para grandes pausas.",
    items: ["Patatas fritas", "Frutos secos", "Chocolatinas", "Galletas", "Snacks saludables", "Chicles y caramelos"],
  },
  {
    id: "bebidas-frias",
    name: "Bebidas frías",
    icon: Droplet,
    image: "/images/catalog/cold-drinks.webp",
    alt: "Surtido de refrescos",
    description: "Agua, refrescos y bebidas isotónicas. Para el día a día y las pausas entre entrenamientos.",
    items: ["Agua mineral", "Refrescos", "Zumos naturales", "Bebidas energéticas", "Tés fríos", "Bebidas isotónicas"],
  },
  {
    id: "bebidas-calientes",
    name: "Bebidas calientes",
    icon: Coffee,
    image: "/images/catalog/coffee.webp",
    alt: "Café cappuccino",
    description: "El ritual que nunca falla. Café y bebidas calientes para acompañar cada momento.",
    items: ["Café espresso", "Café con leche", "Cappuccino", "Chocolate caliente", "Infusiones", "Café americano"],
  },
  {
    id: "varios",
    name: "Y mucho más",
    icon: Package,
    image: "/classic-sandwich.png",
    alt: "Sandwich fresco como ejemplo de un surtido personalizado",
    description: "Cada lugar tiene sus necesidades. Hablemos de una selección hecha para el tuyo.",
    items: [
      "Productos de higiene",
      "Accesorios tecnológicos",
      "Artículos de papelería",
      "Snacks para mascotas",
      "Productos ecológicos",
      "Otras opciones bajo consulta",
    ],
  },
]

export function ProductosGrid() {
  return (
    <>
      <section id="productos" className="catalog-products public-section">
        <ScrollReveal>
          <div className="catalog-intro">
            <span className="public-eyebrow">LA SELECCIÓN LIFY</span>
            <p>
              Lo que te gusta.
              <br />
              <span>Y lo que te queda por descubrir.</span>
            </p>
          </div>
        </ScrollReveal>
        <div className="catalog-categories">
          {categories.map((category, i) => {
            const Icon = category.icon
            return (
              <ScrollReveal key={category.id}>
                <details className="catalog-category" open={i === 0} id={category.id}>
                  <summary>
                    <span className="category-index">0{i + 1}</span>
                    <Icon className="category-icon" strokeWidth={1.4} />
                    <h2>{category.name}</h2>
                    <Plus className="category-plus" strokeWidth={1.2} />
                    <span className="sr-only">Ver productos</span>
                  </summary>
                  <div className="category-content">
                    <div className="category-image">
                      <Image
                        src={category.image}
                        alt={category.alt}
                        width={600}
                        height={400}
                        sizes="(max-width: 767px) 90vw, 40vw"
                      />
                    </div>
                    <div className="category-description">
                      <p>{category.description}</p>
                      <ul>
                        {category.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <Link href="/#contacto" className="public-text-link">
                        Lo quiero en mi espacio <ArrowUpRight size={18} />
                      </Link>
                    </div>
                  </div>
                </details>
              </ScrollReveal>
            )
          })}
        </div>
      </section>
      <section className="catalog-custom public-section">
        <ScrollReveal>
          <span className="public-eyebrow">TU ESPACIO, TU SELECCIÓN</span>
          <h2>
            ¿Algo más
            <br />
            <span>en mente?</span>
          </h2>
          <p>
            Personalizamos el surtido según las necesidades de tu negocio.
            <br />
            Cuéntanos qué buscas y encontramos la combinación.
          </p>
          <Link href="/#contacto" className="public-button">
            Hablemos de tu selección <ArrowUpRight size={20} />
          </Link>
        </ScrollReveal>
      </section>
    </>
  )
}
