/**
 * LOADING SCREEN PROFESIONAL
 * 
 * Componente de carga con el logo de la empresa
 * Usado en toda la aplicación para una experiencia consistente
 */

import Image from 'next/image';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Cargando...' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center space-y-6">
        {/* Logo con animación de pulse */}
        <div className="relative w-32 h-32 animate-pulse">
          <Image
            src="/logo.png"
            alt="Lify Vending"
            fill
            className="object-contain"
            priority
          />
        </div>
        
        {/* Spinner debajo del logo */}
        <div className="flex flex-col items-center space-y-3">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-sm font-medium text-zinc-600">{message}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * LOADING INLINE
 * 
 * Versión más pequeña para usar dentro de componentes
 */
export function LoadingInline({ message }: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-250px)] space-y-6">
      <div className="relative w-40 h-40 animate-pulse">
        <Image
          src="/logo.png"
          alt="Lify Vending"
          fill
          className="object-contain"
        />
      </div>
      <div className="flex flex-col items-center space-y-3">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        {message && <p className="text-sm font-medium text-zinc-600">{message}</p>}
      </div>
    </div>
  );
}
