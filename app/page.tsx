import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { ServicesSection } from "@/components/services-section"
import { WhyUsSection } from "@/components/why-us-section"
import { CallToAction } from "@/components/call-to-action"
import { Footer } from "@/components/footer"
import { ScrollProgress, ScrollReveal } from "@/components/public-scroll-effects"

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <ScrollProgress />
      <Navigation />
      <HeroSection />
      <ScrollReveal>
        <ServicesSection />
      </ScrollReveal>
      <ScrollReveal>
        <WhyUsSection />
      </ScrollReveal>
      <ScrollReveal>
        <CallToAction />
      </ScrollReveal>
      <ScrollReveal>
        <Footer />
      </ScrollReveal>
    </main>
  )
}
