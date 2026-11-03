"use client"

import { useEffect, useRef, type ReactNode } from "react"

const clamp = (value: number) => Math.max(0, Math.min(1, value))

/** One passive, frame-scheduled scroll driver, scoped to the public website. */
export function PublicMotion() {
  const marker = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const root = marker.current?.closest<HTMLElement>(".public-site")
    if (!root) return
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let cleanup = () => {}
    let initialized = false
    const setup = () => {
      cleanup()
      const alignInitialHash = !initialized
      initialized = true
      if (preference.matches) return
      const scenes = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]"))
      const statements = Array.from(root.querySelectorAll<HTMLElement>("[data-statement]"))
      const reveals = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"))
      const progress = root.querySelector<HTMLElement>(".public-progress")
      const railDistance = (track: HTMLElement, viewport: HTMLElement) => {
        const styles = getComputedStyle(viewport)
        return Math.max(
          0,
          track.scrollWidth - viewport.clientWidth + parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight),
        )
      }
      let frame = 0
      let anchorFrame = 0
      const update = () => {
        frame = 0
        const viewport = window.innerHeight
        const range = document.documentElement.scrollHeight - viewport
        progress?.style.setProperty("transform", `scaleX(${range > 0 ? clamp(window.scrollY / range) : 0})`)
        scenes.forEach((scene) => {
          const rect = scene.getBoundingClientRect()
          if (rect.bottom < -viewport || rect.top > viewport * 2) return
          const distance = scene.dataset.scene === "rail" ? rect.height - viewport : rect.height
          const value = clamp(-rect.top / Math.max(1, distance))
          scene.style.setProperty("--progress", String(value))
          if (scene.dataset.scene === "rail") {
            const track = scene.querySelector<HTMLElement>(".service-track")
            const viewportNode = scene.querySelector<HTMLElement>(".service-window")
            if (track && viewportNode)
              track.style.setProperty("--rail-x", `${-value * railDistance(track, viewportNode)}px`)
          }
        })
        statements.forEach((statement) => {
          const rect = statement.getBoundingClientRect()
          if (rect.bottom < 0 || rect.top > viewport) return
          const value = clamp((viewport * 0.8 - rect.top) / Math.max(1, rect.height + viewport * 0.1))
          const words = statement.querySelectorAll<HTMLElement>("[data-word]")
          words.forEach((word, index) =>
            word.style.setProperty(
              "--word-opacity",
              String(0.18 + 0.82 * clamp((value * (words.length + 3) - index) / 2)),
            ),
          )
        })
      }
      const schedule = () => {
        if (!frame) frame = window.requestAnimationFrame(update)
      }
      const revealFocusedService = (event: FocusEvent) => {
        const target = event.target
        if (!(target instanceof HTMLElement) || !target.closest(".service-link")) return
        const scene = target.closest<HTMLElement>("[data-scene='rail']")
        const sticky = scene?.querySelector<HTMLElement>(".services-sticky")
        const track = scene?.querySelector<HTMLElement>(".service-track")
        const viewport = scene?.querySelector<HTMLElement>(".service-window")
        const card = target.closest<HTMLElement>(".service-card")
        if (!scene || !sticky || !track || !viewport || !card || getComputedStyle(sticky).position !== "sticky") return
        const fraction = clamp(card.offsetLeft / Math.max(1, railDistance(track, viewport)))
        viewport.scrollLeft = 0
        window.scrollTo({
          top:
            window.scrollY + scene.getBoundingClientRect().top + fraction * (scene.offsetHeight - window.innerHeight),
          behavior: "instant",
        })
        schedule()
      }
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible")
              observer.unobserve(entry.target)
            }
          })
        },
        { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
      )
      reveals.forEach((element) => {
        if (element.getBoundingClientRect().top < window.innerHeight * 0.95) element.classList.add("is-visible")
        else observer.observe(element)
      })
      root.classList.add("motion-ready")
      const resize = new ResizeObserver(schedule)
      resize.observe(root)
      update()
      if (alignInitialHash && window.location.hash) {
        const target = document.getElementById(window.location.hash.slice(1))
        if (target && root.contains(target)) {
          anchorFrame = window.requestAnimationFrame(() =>
            target.scrollIntoView({ block: "start", behavior: "instant" }),
          )
        }
      }
      window.addEventListener("scroll", schedule, { passive: true })
      window.addEventListener("resize", schedule)
      root.addEventListener("focusin", revealFocusedService)
      cleanup = () => {
        root.classList.remove("motion-ready")
        window.cancelAnimationFrame(frame)
        window.cancelAnimationFrame(anchorFrame)
        window.removeEventListener("scroll", schedule)
        window.removeEventListener("resize", schedule)
        root.removeEventListener("focusin", revealFocusedService)
        observer.disconnect()
        resize.disconnect()
        scenes.forEach((scene) => scene.style.removeProperty("--progress"))
        statements.forEach((statement) =>
          statement
            .querySelectorAll<HTMLElement>("[data-word]")
            .forEach((word) => word.style.removeProperty("--word-opacity")),
        )
      }
    }
    setup()
    preference.addEventListener("change", setup)
    return () => {
      cleanup()
      preference.removeEventListener("change", setup)
    }
  }, [])
  return <span ref={marker} hidden />
}

export function ScrollProgress() {
  return <div className="public-progress" aria-hidden="true" />
}

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <div data-reveal className={className} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

export function ScrollStatement({ text }: { text: string }) {
  return (
    <p className="scroll-statement" data-statement aria-label={text}>
      {text.split(" ").map((word, index) => (
        <span key={index} data-word aria-hidden="true">
          {word}{" "}
        </span>
      ))}
    </p>
  )
}
