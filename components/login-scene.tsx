"use client"

import { useEffect, useRef } from "react"

export function LoginScene({ phase }: { phase: "idle" | "loading" | "granted" }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    let visible = true
    const update = () => {
      node.dataset.visible = String(visible && !document.hidden)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      update()
    })
    observer.observe(node)
    document.addEventListener("visibilitychange", update)
    update()
    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", update)
    }
  }, [])
  return (
    <aside ref={ref} className="login-scene" aria-hidden="true">
      <div className="login-scene-copy">
        <span className="login-eyebrow">LIFY VENDING / AL OTRO LADO</span>
        <h2>
          Detrás de
          <br />
          <span>cada pausa.</span>
        </h2>
      </div>
      <div className="login-machine-stage">
        <div className="login-door">
          <span className="login-door-left" />
          <span className="login-door-right" />
        </div>
        <svg className="login-portal" viewBox="0 0 360 460" fill="none" preserveAspectRatio="none">
          <rect className="login-portal-glow" x="24" y="16" width="312" height="428" rx="24" pathLength="1" />
          <rect className="login-portal-line" x="24" y="16" width="312" height="428" rx="24" pathLength="1" />
          <path
            d="M24 82V40a24 24 0 0 1 24-24h42M270 444h42a24 24 0 0 0 24-24v-42"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        {/* Reuse the transparent photographic master already used by the public hero. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="login-machine-image"
          src="/images/startup/machine-isolated-v2-1122.webp"
          srcSet="/images/startup/machine-isolated-v2-560.webp 560w, /images/startup/machine-isolated-v2-1122.webp 1122w"
          sizes="(max-width: 900px) 240px, 400px"
          width={1122}
          height={1402}
          alt=""
          loading="eager"
          fetchPriority="high"
        />
        <span className="login-scanline" />
      </div>
      <p className="login-scene-status">
        <span />
        {phase === "granted"
          ? "TODO LISTO. BIENVENIDO."
          : phase === "loading"
            ? "COMPROBANDO TU ACCESO"
            : "CADA DÍA, TODO EN MARCHA."}
      </p>
    </aside>
  )
}
