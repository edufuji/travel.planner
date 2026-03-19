import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useTripsStore } from '@/stores/tripsStore'
import DestinationRow from '@/components/DestinationRow'
import NewDestinationSheet from '@/components/sheets/NewDestinationSheet'
import BottomNav from '@/components/BottomNav'
import LocalDataImport from '@/components/LocalDataImport'

const snappy = { type: 'spring', stiffness: 400, damping: 17 } as const

const listContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

const listItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
}

export default function TripsPage() {
  const { t } = useTranslation()
  const destinations = useTripsStore(s => s.destinations)
  const deleteDestination = useTripsStore(s => s.deleteDestination)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <motion.div
      className="min-h-screen bg-background pb-20"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-30%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t('trips.myTrips')}</h1>
          <p className="text-xs text-muted">
            {t('trips.destinationCount', { count: destinations.length })}
          </p>
        </div>
        <motion.button
          onClick={() => setSheetOpen(true)}
          className="bg-primary text-white rounded-full px-4 py-2 text-sm font-bold hover:bg-primary-dark transition-colors"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.93 }}
          transition={snappy}
        >
          {t('trips.newButton')}
        </motion.button>
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {destinations.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="text-5xl mb-4" aria-hidden="true">🗺️</div>
            <h2 className="text-lg font-bold text-foreground mb-1">{t('trips.emptyHeading')}</h2>
            <p className="text-sm text-muted mb-6">{t('trips.emptySubtext')}</p>
            <motion.button
              onClick={() => setSheetOpen(true)}
              className="bg-primary text-white rounded-full px-6 py-2.5 text-sm font-bold hover:bg-primary-dark transition-colors"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.93 }}
              transition={snappy}
            >
              {t('trips.planFirstTrip')}
            </motion.button>
          </div>
        ) : (
          <>
            <motion.div
              className="space-y-2"
              variants={listContainer}
              initial="hidden"
              animate="visible"
            >
              {destinations.map(d => (
                <motion.div key={d.id} variants={listItem}>
                  <DestinationRow
                    destination={d}
                    onDelete={deleteDestination}
                  />
                </motion.div>
              ))}
            </motion.div>
            <motion.div
              className="border-2 border-dashed border-border rounded-[10px] p-3 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSheetOpen(true)}
              role="button"
              whileTap={{ scale: 0.98 }}
              transition={snappy}
            >
              <span className="text-sm text-muted">{t('trips.planNewDestination')}</span>
            </motion.div>
          </>
        )}
      </div>

      <NewDestinationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <LocalDataImport />
      <BottomNav />
    </motion.div>
  )
}
