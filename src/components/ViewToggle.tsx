import { List, Map } from 'lucide-react'

type View = 'timeline' | 'map'

interface ViewToggleProps {
  active: View
  onChange: (view: View) => void
}

export default function ViewToggle({ active, onChange }: ViewToggleProps) {
  return (
    <div className="flex w-full bg-input-bg rounded-full p-0.5">
      <button
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition-colors ${
          active === 'timeline' ? 'bg-primary text-white' : 'bg-input-bg text-muted'
        }`}
        aria-pressed={String(active === 'timeline')}
        onClick={() => onChange('timeline')}
      >
        <List size={14} />
        Timeline
      </button>
      <button
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition-colors ${
          active === 'map' ? 'bg-primary text-white' : 'bg-input-bg text-muted'
        }`}
        aria-pressed={String(active === 'map')}
        onClick={() => onChange('map')}
      >
        <Map size={14} />
        Map
      </button>
    </div>
  )
}
