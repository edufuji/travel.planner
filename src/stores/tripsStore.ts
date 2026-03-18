import { create } from 'zustand'
import type { Destination, TripEvent } from '../types/trip'
import { assignEmoji } from '../lib/travelEmojis'
import { supabase } from '../lib/supabase'
import {
  dbDestinationToDestination,
  dbEventToTripEvent,
  destinationToDbInsert,
  tripEventToDbInsert,
  destinationToDbUpdate,
  eventToDbUpdate,
} from '../lib/tripsMapper'

interface TripsState {
  destinations: Destination[]
  loading: boolean
  fetchDestinations: (userId: string) => Promise<void>
  clearDestinations: () => void
  addDestination: (userId: string, d: Omit<Destination, 'id' | 'events' | 'createdAt'>) => Promise<Destination>
  updateDestination: (id: string, patch: Partial<Omit<Destination, 'id' | 'events'>>) => Promise<void>
  deleteDestination: (id: string) => Promise<void>
  addEvent: (destinationId: string, userId: string, e: Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>) => Promise<void>
  updateEvent: (destinationId: string, eventId: string, patch: Partial<Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>>) => Promise<void>
  deleteEvent: (destinationId: string, eventId: string) => Promise<void>
}

export const useTripsStore = create<TripsState>()((set, get) => ({
  destinations: [],
  loading: false,

  fetchDestinations: async (userId) => {
    set({ loading: true })
    const { data: destRows, error: destError } = await supabase
      .from('destinations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (destError) {
      set({ loading: false })
      throw new Error(destError.message)
    }

    const { data: eventRows, error: eventError } = await supabase
      .from('trip_events')
      .select('*')
      .eq('user_id', userId)
    if (eventError) {
      set({ loading: false })
      throw new Error(eventError.message)
    }

    const destinations = (destRows ?? []).map(row => {
      const events = (eventRows ?? [])
        .filter(e => e.destination_id === row.id)
        .map(dbEventToTripEvent)
      return dbDestinationToDestination(row, events)
    })

    set({ destinations, loading: false })
  },

  clearDestinations: () => {
    set({ destinations: [] })
  },

  addDestination: async (userId, d) => {
    const emoji = d.emoji || assignEmoji(get().destinations.length)
    const { data, error } = await supabase
      .from('destinations')
      .insert(destinationToDbInsert({ ...d, emoji }, userId))
      .select()
      .single()
    if (error) throw new Error(error.message)
    const newDest = dbDestinationToDestination(data, [])
    set(state => ({ destinations: [newDest, ...state.destinations] }))
    return newDest
  },

  updateDestination: async (id, patch) => {
    const { error } = await supabase
      .from('destinations')
      .update(destinationToDbUpdate(patch))
      .eq('id', id)
    if (error) throw new Error(error.message)
    set(state => ({
      destinations: state.destinations.map(d =>
        d.id === id ? { ...d, ...patch } : d
      ),
    }))
  },

  deleteDestination: async (id) => {
    const { error } = await supabase
      .from('destinations')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
    set(state => ({
      destinations: state.destinations.filter(d => d.id !== id),
    }))
  },

  addEvent: async (destinationId, userId, e) => {
    const { data, error } = await supabase
      .from('trip_events')
      .insert(tripEventToDbInsert({ ...e, destinationId }, userId))
      .select()
      .single()
    if (error) throw new Error(error.message)
    const newEvent = dbEventToTripEvent(data)
    set(state => ({
      destinations: state.destinations.map(d =>
        d.id === destinationId
          ? { ...d, events: [...d.events, newEvent] }
          : d
      ),
    }))
  },

  updateEvent: async (destinationId, eventId, patch) => {
    const { error } = await supabase
      .from('trip_events')
      .update(eventToDbUpdate(patch))
      .eq('id', eventId)
    if (error) throw new Error(error.message)
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

  deleteEvent: async (destinationId, eventId) => {
    const { error } = await supabase
      .from('trip_events')
      .delete()
      .eq('id', eventId)
    if (error) throw new Error(error.message)
    set(state => ({
      destinations: state.destinations.map(d =>
        d.id === destinationId
          ? { ...d, events: d.events.filter(e => e.id !== eventId) }
          : d
      ),
    }))
  },
}))
