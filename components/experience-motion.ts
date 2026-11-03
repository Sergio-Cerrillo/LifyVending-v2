"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const clamp = (value: number) => Math.max(0, Math.min(1, value))

/** Scroll updates CSS directly; React only renders when the chapter changes. */
export function useScrollChapters(count: number, mobileMinimumHeight = 700) {
  const ref = useRef<HTMLElement>(null)
  const activeRef = useRef(0)
  const [active, setActive] = useState(0)
  const [scrollDriven, setScrollDriven] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    let visible = true
    let enabled = false

    const update = () => {
      frame = 0
      if (!enabled || !visible) return
      const rect = node.getBoundingClientRect()
      const progress = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight))
      node.style.setProperty("--scene-progress", String(progress))
      const next = Math.min(count - 1, Math.floor(progress * count))
      if (next !== activeRef.current) {
        activeRef.current = next
        setActive(next)
      }
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    const resize = () => {
      const minimumHeight = window.innerWidth < 768 ? mobileMinimumHeight : 700
      enabled = !preference.matches && window.innerHeight >= minimumHeight
      node.classList.toggle("is-scroll-driven", enabled)
      setScrollDriven(enabled)
      schedule()
    }
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) schedule()
      },
      { rootMargin: "100% 0px" },
    )
    const observer = new ResizeObserver(schedule)
    intersection.observe(node)
    observer.observe(node)
    resize()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", resize)
    preference.addEventListener("change", resize)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", resize)
      preference.removeEventListener("change", resize)
      intersection.disconnect()
      observer.disconnect()
      node.classList.remove("is-scroll-driven")
    }
  }, [count, mobileMinimumHeight])

  const select = useCallback(
    (index: number) => {
      const node = ref.current
      if (!node) return
      const next = Math.max(0, Math.min(count - 1, index))
      if (node.classList.contains("is-scroll-driven")) {
        const rect = node.getBoundingClientRect()
        const position = (next + 0.35) / count
        window.scrollTo({
          top: window.scrollY + rect.top + position * Math.max(0, rect.height - window.innerHeight),
          behavior: "smooth",
        })
      } else {
        activeRef.current = next
        setActive(next)
        node.style.setProperty("--scene-progress", String((next + 0.35) / count))
      }
    },
    [count],
  )

  return { ref, active, select, scrollDriven }
}
