import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTripsStore } from '@/stores/tripsStore'

export function useDestinationsSync() {
  const { user } = useAuth()
  const fetchDestinations = useTripsStore(s => s.fetchDestinations)
  const clearDestinations = useTripsStore(s => s.clearDestinations)

  useEffect(() => {
    if (user) {
      fetchDestinations(user.id).catch(console.error)
    } else {
      clearDestinations()
    }
  }, [user?.id])  // re-run only when the user ID changes
}
