"use client"

import { useEffect, type RefObject } from "react"

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const ease = (value: number) => value * value * value * (value * (value * 6 - 15) + 10)
const phase = (value: number, from: number, to: number) => ease(clamp((value - from) / (to - from)))

/** The frame and its glass aperture share one geometry, so the portal never drifts. */
export function useCatalogPortal(
  sectionRef: RefObject<HTMLElement | null>,
  viewportRef: RefObject<HTMLDivElement | null>,
  machineRef: RefObject<HTMLDivElement | null>,
  glassRef: RefObject<HTMLDivElement | null>,
  worldRef: RefObject<HTMLDivElement | null>,
  directLinkRef: RefObject<HTMLAnchorElement | null>,
) {
  useEffect(() => {
    const section = sectionRef.current
    const viewport = viewportRef.current
    const machine = machineRef.current
    const glass = glassRef.current
    const world = worldRef.current
    if (!section || !viewport || !machine || !glass || !world) return
    const cue = viewport.querySelector<HTMLElement>(".catalog-enter-cue")
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let enabled = false,
      visible = true,
      frame = 0,
      current = 0,
      velocity = 0,
      lastTime = 0,
      firstFrame = true
    let geometry = { width: 1, height: 1, x: 0, y: 0, glassWidth: 1, glassHeight: 1, cover: 1 }

    const draw = (progress: number) => {
      const g = geometry
      const zoom = phase(progress, 0.08, 0.81)
      const center = phase(progress, 0.03, 0.59)
      const scale = Math.exp(Math.log(g.cover) * zoom)
      const angle = -4 * (1 - phase(progress, 0, 0.38))
      const radians = (angle * Math.PI) / 180
      const tx = (g.width / 2 - g.x) * center
      const ty = (g.height / 2 - g.y) * center
      machine.style.transform = `translate3d(${tx}px,${ty}px,0) rotate(${angle}deg) scale(${scale})`
      const points = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) => {
        const dx = ((x * g.glassWidth) / 2) * scale
        const dy = ((y * g.glassHeight) / 2) * scale
        return `${g.x + tx + dx * Math.cos(radians) - dy * Math.sin(radians)}px ${g.y + ty + dx * Math.sin(radians) + dy * Math.cos(radians)}px`
      })
      world.style.clipPath = `polygon(${points.join(",")})`
      viewport.style.setProperty("--catalog-copy", String(1 - phase(progress, 0.02, 0.24)))
      viewport.style.setProperty("--catalog-stock", String(1 - phase(progress, 0.18, 0.57)))
      viewport.style.setProperty("--catalog-reflection", String(1 - phase(progress, 0.15, 0.64)))
      viewport.style.setProperty("--catalog-reveal", String(phase(progress, 0.42, 0.8)))
      viewport.style.setProperty("--catalog-progress", String(progress))
      section.dataset.portalProgress = progress.toFixed(5)
      const inside = enabled && progress >= 0.86
      if (!inside && world.contains(document.activeElement)) directLinkRef.current?.focus({ preventScroll: true })
      world.inert = !inside
      world.setAttribute("aria-hidden", String(!inside))
      if (cue) {
        const hidden = progress > 0.1
        if (hidden && cue.contains(document.activeElement)) directLinkRef.current?.focus({ preventScroll: true })
        cue.inert = hidden
        cue.setAttribute("aria-hidden", String(hidden))
      }
      if (inside && section.dataset.portalFocus === "pending") {
        world.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true })
        delete section.dataset.portalFocus
      }
      section.dataset.portalPhase = inside ? "inside" : progress > 0.1 ? "entering" : "outside"
    }
    const target = () =>
      enabled
        ? clamp(-section.getBoundingClientRect().top / Math.max(1, section.offsetHeight - viewport.offsetHeight))
        : 0
    const tick = (time: number) => {
      frame = 0
      const desired = target()
      const dt = (lastTime ? Math.min(48, time - lastTime) : 16) / 1000
      lastTime = time
      if (firstFrame || !enabled) {
        current = desired
        velocity = 0
        firstFrame = false
      } else {
        const displacement = current - desired
        const momentum = velocity + 11 * displacement
        const decay = Math.exp(-11 * dt)
        current = clamp(desired + (displacement + momentum * dt) * decay)
        velocity = (velocity - 11 * momentum * dt) * decay
      }
      const settled = Math.abs(desired - current) < 0.0001 && Math.abs(velocity) < 0.001
      if (settled) {
        current = desired
        velocity = 0
      }
      draw(current)
      section.dataset.portalMoving = String(!settled)
      if (!settled && visible && !document.hidden) frame = requestAnimationFrame(tick)
      else lastTime = 0
    }
    const schedule = () => {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick)
    }
    const measure = () => {
      const width = glass.clientWidth,
        height = glass.clientHeight
      const cx = glass.offsetLeft + glass.clientLeft + width / 2
      const cy = glass.offsetTop + glass.clientTop + height / 2
      geometry = {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
        x: machine.offsetLeft + cx,
        y: machine.offsetTop + cy,
        glassWidth: width,
        glassHeight: height,
        cover: Math.max(viewport.clientWidth / Math.max(1, width), viewport.clientHeight / Math.max(1, height)) * 1.16,
      }
      machine.style.transformOrigin = `${cx}px ${cy}px`
      draw(current)
      schedule()
    }
    const configure = () => {
      const wasInside =
        enabled && section.getBoundingClientRect().top < -80 && section.getBoundingClientRect().bottom > 0
      enabled = !preference.matches && window.innerHeight >= (window.innerWidth < 768 ? 700 : 640)
      section.classList.toggle("is-portal-active", enabled)
      if (!enabled) {
        current = 0
        velocity = 0
      }
      measure()
      if (wasInside && !enabled)
        document.getElementById("productos")?.scrollIntoView({ block: "start", behavior: "instant" })
    }
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
        frame = 0
        lastTime = 0
      } else schedule()
    }
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) schedule()
        else {
          cancelAnimationFrame(frame)
          frame = 0
          lastTime = 0
        }
      },
      { rootMargin: "100px" },
    )
    const resize = new ResizeObserver(measure)
    configure()
    intersection.observe(section)
    resize.observe(viewport)
    resize.observe(machine)
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", configure)
    preference.addEventListener("change", configure)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      cancelAnimationFrame(frame)
      intersection.disconnect()
      resize.disconnect()
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", configure)
      preference.removeEventListener("change", configure)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [sectionRef, viewportRef, machineRef, glassRef, worldRef, directLinkRef])
}
