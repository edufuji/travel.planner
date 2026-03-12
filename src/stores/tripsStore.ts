import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Destination, TripEvent } from '../types/trip'
import { assignEmoji } from '../lib/travelEmojis'

interface TripsState {
  destinations: Destination[]
  addDestination: (d: Omit<Destination, 'id' | 'events' | 'createdAt'>) => void
  updateDestination: (id: string, patch: Partial<Omit<Destination, 'id' | 'events'>>) => void
  deleteDestination: (id: string) => void
  addEvent: (destinationId: string, e: Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>) => void
  updateEvent: (destinationId: string, eventId: string, patch: Partial<Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>>) => void
  deleteEvent: (destinationId: string, eventId: string) => void
}

export const useTripsStore = create<TripsState>()(
  persist(
    (set, get) => ({
      destinations: [],

      addDestination: (d) => {
        const { destinations } = get()
        const newDest: Destination = {
          ...d,
          id: crypto.randomUUID(),
          emoji: assignEmoji(destinations.length),
          events: [],
          createdAt: new Date().toISOString(),
        }
        set({ destinations: [newDest, ...destinations] })
      },

      updateDestination: (id, patch) => {
        set(state => ({
          destinations: state.destinations.map(d =>
            d.id === id ? { ...d, ...patch } : d
          ),
        }))
      },

      deleteDestination: (id) => {
        set(state => ({
          destinations: state.destinations.filter(d => d.id !== id),
        }))
      },

      addEvent: (destinationId, e) => {
        const newEvent: TripEvent = {
          ...e,
          id: crypto.randomUUID(),
          destinationId,
          createdAt: new Date().toISOString(),
        }
        set(state => ({
          destinations: state.destinations.map(d =>
            d.id === destinationId
              ? { ...d, events: [...d.events, newEvent] }
              : d
          ),
        }))
      },

      updateEvent: (destinationId, eventId, patch) => {
        set(state => ({
          destinations: state.destinations.map(d =>
            d.id === destinationId
              ? {
                  ...d,
                  events: d.events.map(e =>
                    e.id === eventId ? { ...e, ...patch } : e
                  ),
                }
              : d
          ),
        }))
      },

      deleteEvent: (destinationId, eventId) => {
        set(state => ({
          destinations: state.destinations.map(d =>
            d.id === destinationId
              ? { ...d, events: d.events.filter(e => e.id !== eventId) }
              : d
          ),
        }))
      },
    }),
    { name: 'tripmate-trips' }
  )
)
