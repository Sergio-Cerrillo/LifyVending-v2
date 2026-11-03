"use client"

import { useEffect, useRef, type RefObject } from "react"

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smootherstep = (value: number) => value * value * value * (value * (value * 6 - 15) + 10)

/** One continuous playhead for scroll, buttons and reversals, without React renders per frame. */
export function useExplodedMotion(
  sectionRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLDivElement | null>,
  phases: readonly { start: number; end: number }[],
  manualOpen: boolean | null,
  scrollDriven: boolean,
) {
  const controls = useRef({ manualOpen, scrollDriven })
  const playhead = useRef(0)
  const wake = useRef<() => void>(() => {})

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    if (!section || !stage) return
    const nodes = Array.from(stage.querySelectorAll<HTMLElement>(".exploded-photo-layer"))
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    let previousTime = 0
    let velocity = 0
    let visible = true

    const target = () => {
      const control = controls.current
      if (control.manualOpen !== null) return Number(control.manualOpen)
      if (!control.scrollDriven) return 0
      const progress = Number(section.style.getPropertyValue("--scene-progress")) || 0
      // Hold a fully mounted view on arrival and a fully open view at the end.
      return clamp((progress - 0.08) / 0.84)
    }
    const draw = (value: number) => {
      stage.style.setProperty("--open", value.toFixed(6))
      nodes.forEach((node, index) => {
        const phase = phases[index]
        const local = clamp((value - phase.start) / (phase.end - phase.start))
        node.style.setProperty("--layer-open", smootherstep(local).toFixed(6))
      })
    }
    const tick = (time: number) => {
      frame = 0
      const desired = target()
      const elapsed = previousTime ? Math.min(48, time - previousTime) : 16
      previousTime = time
      // Analytic critical damping preserves velocity when the target changes.
      // Both the position and speed remain continuous during an interruption.
      const seconds = elapsed / 1000
      const frequency = 7
      const displacement = playhead.current - desired
      const momentum = velocity + frequency * displacement
      const decay = Math.exp(-frequency * seconds)
      const next = preference.matches ? desired : clamp(desired + (displacement + momentum * seconds) * decay)
      velocity = preference.matches ? 0 : (velocity - frequency * momentum * seconds) * decay
      const settled = Math.abs(desired - next) < 0.0002 && Math.abs(velocity) < 0.002
      playhead.current = settled ? desired : next
      if (settled) velocity = 0
      draw(playhead.current)
      stage.dataset.moving = String(!settled)
      if (!settled && visible && !document.hidden) frame = requestAnimationFrame(tick)
      else previousTime = 0
    }
    const schedule = () => {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick)
    }
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
        frame = 0
        previousTime = 0
      } else schedule()
    }
    const mutation = new MutationObserver(schedule)
    mutation.observe(section, { attributes: true, attributeFilter: ["style"] })
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) schedule()
        else {
          cancelAnimationFrame(frame)
          frame = 0
          previousTime = 0
        }
      },
      { rootMargin: "100px" },
    )
    intersection.observe(stage)
    preference.addEventListener("change", schedule)
    document.addEventListener("visibilitychange", visibility)
    wake.current = schedule
    draw(playhead.current)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      mutation.disconnect()
      intersection.disconnect()
      preference.removeEventListener("change", schedule)
      document.removeEventListener("visibilitychange", visibility)
      wake.current = () => {}
    }
  }, [sectionRef, stageRef, phases])

  useEffect(() => {
    controls.current = { manualOpen, scrollDriven }
    wake.current()
  }, [manualOpen, scrollDriven])
}
