import { Play } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Aula Stream">
      <span className="brand-mark"><Play size={18} fill="currentColor" /></span>
      {!compact && <span>Aula<span>Stream</span></span>}
    </div>
  )
}
