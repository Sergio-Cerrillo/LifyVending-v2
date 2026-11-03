import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { ServicesSection } from "@/components/services-section"
import { WhyUsSection } from "@/components/why-us-section"
import { CallToAction } from "@/components/call-to-action"
import { Footer } from "@/components/footer"
import { PublicMotion, ScrollProgress } from "@/components/public-scroll-effects"
import { PublicIntro } from "@/components/public-intro"
import { EnvironmentStory } from "@/components/environment-story"
import "./public-site.css"
import "./experiences.css"
import "./hero-visual.css"
import "./brand-scenes.css"
import "./vending-startup.css"

export default function Home() {
  return (
    <main className="public-site public-home" data-intro="pending">
      <PublicMotion />
      <ScrollProgress />
      <Navigation />
      <HeroSection />
      <PublicIntro />
      <ServicesSection />
      <EnvironmentStory />
      <WhyUsSection />
      <CallToAction />
      <Footer />
    </main>
  )
}
