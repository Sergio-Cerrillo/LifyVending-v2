import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AnimatedBackground } from "@/components/animated-background"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Lify Vending - Máquinas Vending Sin Inversión",
  description:
    "Tu negocio sin inversión ni riesgos. Instalamos, mantenemos y reponemos las máquinas vending. Tú solo recibes tu comisión. Más de 25 años de experiencia.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/LifyVending/logo.png",
      },
    ],
    apple: "/LifyVending/logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <AnimatedBackground />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <div className="relative z-10">{children}</div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
