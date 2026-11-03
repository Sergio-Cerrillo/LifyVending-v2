"use client"

import { useEffect, useRef } from "react"

const source = "/images/startup/machine-isolated-v2-1122.webp"
const sources = "/images/startup/machine-isolated-v2-560.webp 560w, /images/startup/machine-isolated-v2-1122.webp 1122w"
const sizes = "(max-width: 767px) 80vw, (max-width: 1100px) 45vw, 40vw"

/** A single transparent master supplies every lighting layer, so the machine cannot drift. */
export function VendingStartup() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const hero = node.closest<HTMLElement>(".public-hero")
    const root = node.closest<HTMLElement>(".public-home")
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let disposed = false
    let finished = false
    const complete = () => {
      if (finished) return
      finished = true
      node.dataset.startup = "complete"
      if (hero) hero.dataset.startup = "complete"
      if (root) root.dataset.intro = "complete"
    }
    const visibility = () => {
      if (hero) hero.dataset.startupHidden = String(document.hidden)
      if (root) root.dataset.introHidden = String(document.hidden)
    }
    const onPreference = () => {
      if (preference.matches) complete()
    }
    const onEnd = (event: AnimationEvent) => {
      if (event.animationName === "lify-startup-clock") complete()
    }
    const images = Array.from(node.querySelectorAll("img"))
    Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => {
      if (disposed || finished) return
      if (preference.matches || images.some((image) => !image.naturalWidth)) return complete()
      node.dataset.startup = "running"
      if (hero) hero.dataset.startup = "running"
      if (root) root.dataset.intro = "running"
    })
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) complete()
    })
    const skipOnKey = (event: KeyboardEvent) => {
      if (["Tab", "Enter", " ", "Escape", "ArrowDown", "PageDown"].includes(event.key)) complete()
    }
    const skipOnScroll = () => {
      if (window.scrollY > 24) complete()
    }
    const fallback = window.setTimeout(complete, 4000)
    if (hero) observer.observe(hero)
    onPreference()
    if (window.scrollY > 24 || window.location.hash) complete()
    visibility()
    preference.addEventListener("change", onPreference)
    document.addEventListener("visibilitychange", visibility)
    document.addEventListener("keydown", skipOnKey, true)
    document.addEventListener("pointerdown", complete, { capture: true, passive: true })
    document.addEventListener("focusin", complete, true)
    window.addEventListener("scroll", skipOnScroll, { passive: true })
    node.addEventListener("animationend", onEnd)
    return () => {
      disposed = true
      window.clearTimeout(fallback)
      observer.disconnect()
      preference.removeEventListener("change", onPreference)
      document.removeEventListener("visibilitychange", visibility)
      document.removeEventListener("keydown", skipOnKey, true)
      document.removeEventListener("pointerdown", complete, true)
      document.removeEventListener("focusin", complete, true)
      window.removeEventListener("scroll", skipOnScroll)
      node.removeEventListener("animationend", onEnd)
    }
  }, [])

  return (
    <div ref={ref} className="vending-startup" data-startup="pending">
      <div className="startup-camera">
        {/* The same cached master supplies interior and contour light. No visible off layer. */}
        {/* eslint-disable @next/next/no-img-element */}
        <img
          className="startup-lit"
          src={source}
          srcSet={sources}
          sizes={sizes}
          alt=""
          width={1122}
          height={1402}
          fetchPriority="high"
          loading="eager"
          decoding="async"
        />
        <img
          className="startup-edge"
          src={source}
          srcSet={sources}
          sizes={sizes}
          alt=""
          width={1122}
          height={1402}
          loading="eager"
          decoding="async"
        />
        {/* eslint-enable @next/next/no-img-element */}
      </div>
      <span className="startup-clock" aria-hidden="true" />
      <noscript>
        <style>{`.public-site .vending-startup .startup-lit{opacity:1!important;animation:none!important}.public-site.public-home[data-intro] .public-nav,.public-site.public-home[data-intro] .hero-copy h1>span,.public-site.public-home[data-intro] .hero-coordinate,.public-site.public-home[data-intro] .hero-copy>p,.public-site.public-home[data-intro] .hero-copy>.public-button,.public-site.public-home[data-intro] .hero-bottom{opacity:1!important;animation:none!important}`}</style>
      </noscript>
    </div>
  )
}
