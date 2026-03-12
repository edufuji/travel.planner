// placeholder — replaced in Task 17
interface Props {
  open: boolean
  onClose: () => void
  destinationId: string
  editEvent?: import('@/types/trip').TripEvent
}
export default function AddEventSheet({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div role="dialog">
      <button onClick={onClose}>Close</button>
    </div>
  )
}
