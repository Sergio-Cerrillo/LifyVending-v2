"use client"

import { useEffect } from "react"

// Supabase's dashboard emails use Site URL as their default destination.
export function RecoveryRedirect() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (hash.get("type") === "recovery") {
      window.location.replace(`/restablecer-contrasena${window.location.search}${window.location.hash}`)
    }
  }, [])
  return null
}
