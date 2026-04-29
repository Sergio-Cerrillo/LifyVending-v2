import { cn } from '@/lib/utils'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-zinc-100 animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

interface LoadingCardProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

function LoadingCard({ title = 'Cargando...', description = 'Por favor espera un momento', children }: LoadingCardProps) {
  return (
    <Card className="border border-zinc-200">
      <CardContent className="pt-6">
        {/* Logo y Spinner */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100">
          <div className="relative w-16 h-16 shrink-0">
            <Image 
              src="/logo.png" 
              alt="Logo" 
              width={64}
              height={64}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-900">{title}</h3>
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-500 mt-1">{description}</p>
          </div>
        </div>
        
        {/* Contenido skeleton */}
        {children}
      </CardContent>
    </Card>
  )
}

export { Skeleton, LoadingCard }
