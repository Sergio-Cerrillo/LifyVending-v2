import { VendingStartup } from "@/components/vending-startup"

export function HeroVisual() {
  return (
    <div className="hero-world hero-world--cinema" aria-hidden="true">
      <div className="hero-art">
        <div className="hero-machine">
          <VendingStartup />
        </div>
      </div>
    </div>
  )
}
