import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const variantStyles = {
  default: 'bg-zinc-100 text-zinc-700 border border-zinc-200',
  success: 'bg-zinc-900 text-white border border-zinc-900',
  warning: 'bg-zinc-400 text-white border border-zinc-400',
  danger: 'bg-zinc-700 text-white border border-zinc-700',
  info: 'bg-zinc-200 text-zinc-800 border border-zinc-300',
};

export function StatusBadge({ status, variant = 'default', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {status}
    </span>
  );
}

// Helper function to get badge variant based on status
export function getDocumentReviewVariant(status: string): StatusBadgeProps['variant'] {
  switch (status) {
    case 'REVISADA':
      return 'success';
    case 'PENDIENTE':
      return 'warning';
    default:
      return 'default';
  }
}

export function getDocumentAccountingVariant(status: string): StatusBadgeProps['variant'] {
  switch (status) {
    case 'CONTABILIZADA':
      return 'success';
    case 'PENDIENTE':
      return 'warning';
    default:
      return 'default';
  }
}

export function getMachineStatusVariant(status: string): StatusBadgeProps['variant'] {
  switch (status) {
    case 'ACTIVA':
      return 'success';
    case 'ALMACEN':
      return 'info';
    case 'AVERIADA':
      return 'danger';
    case 'RETIRADA':
      return 'default';
    default:
      return 'default';
  }
}

export function getIncidentStatusVariant(status: string): StatusBadgeProps['variant'] {
  switch (status) {
    case 'ABIERTA':
      return 'danger';
    case 'EN_PROCESO':
      return 'warning';
    case 'CERRADA':
      return 'success';
    default:
      return 'default';
  }
}
