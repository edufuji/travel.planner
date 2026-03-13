interface Props {
  message: string
}

export default function GapWarningCard({ message }: Props) {
  return (
    <div
      className="border border-dashed border-primary rounded-lg px-3 py-2 bg-[#FFF7ED] dark:bg-transparent"
      role="alert"
    >
      <p className="text-xs text-[#C75B2A] font-medium">⚠️ {message}</p>
    </div>
  )
}
