import { cn } from '@/lib/utils'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
}

export default function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn('relative z-10', className)}
      style={{
        background: 'rgba(255,250,246,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.5)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        borderRadius: '20px',
      }}
    >
      {children}
    </div>
  )
}
