import { motion } from 'framer-motion'

interface Props {
  label: string
}

export default function TimelineDateHeader({ label }: Props) {
  return (
    <motion.div className="pt-4 pb-1 first:pt-0">
      <span className="text-xs font-bold text-primary uppercase tracking-wide">
        {label}
      </span>
    </motion.div>
  )
}
