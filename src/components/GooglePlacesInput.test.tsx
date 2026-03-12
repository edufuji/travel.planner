import { render, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import GooglePlacesInput from './GooglePlacesInput'

vi.mock('@googlemaps/js-api-loader', () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('GooglePlacesInput', () => {
  it('renders fallback input when no API key is set', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <GooglePlacesInput value="" onChange={onChange} />
    )
    expect(getByTestId('places-input-fallback')).toBeInTheDocument()
  })

  it('renders Places input (not fallback) when API key is set', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key')
    vi.stubGlobal('google', { maps: { places: { Autocomplete: vi.fn(() => ({ addListener: vi.fn() })) } } })
    const { getByTestId } = render(
      <GooglePlacesInput value="" onChange={vi.fn()} />
    )
    expect(getByTestId('places-input')).toBeInTheDocument()
  })

  it('calls onChange with (name, placeId, lat, lng) when geometry is present', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key')

    let placeChangedCb: (() => void) | undefined
    const mockAc = {
      addListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'place_changed') placeChangedCb = cb
      }),
      getPlace: vi.fn(() => ({
        name: 'Tokyo Tower',
        place_id: 'ChIJplace123',
        geometry: {
          location: { lat: () => 35.6586, lng: () => 139.7454 },
        },
      })),
    }
    vi.stubGlobal('google', {
      maps: { places: { Autocomplete: vi.fn(() => mockAc) } },
    })

    const onChange = vi.fn()
    render(<GooglePlacesInput value="" onChange={onChange} />)

    // Wait for importLibrary promise to resolve and Autocomplete to initialize
    await act(async () => { await Promise.resolve() })

    expect(placeChangedCb).toBeDefined()
    act(() => { placeChangedCb!() })

    expect(onChange).toHaveBeenCalledWith('Tokyo Tower', 'ChIJplace123', 35.6586, 139.7454)
  })

  it('calls onChange with (name, placeId, undefined, undefined) when geometry is absent', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key')

    let placeChangedCb: (() => void) | undefined
    const mockAc = {
      addListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'place_changed') placeChangedCb = cb
      }),
      getPlace: vi.fn(() => ({
        name: 'Some Place',
        place_id: 'abc',
        geometry: undefined,
      })),
    }
    vi.stubGlobal('google', {
      maps: { places: { Autocomplete: vi.fn(() => mockAc) } },
    })

    const onChange = vi.fn()
    render(<GooglePlacesInput value="" onChange={onChange} />)
    await act(async () => { await Promise.resolve() })

    act(() => { placeChangedCb!() })

    expect(onChange).toHaveBeenCalledWith('Some Place', 'abc', undefined, undefined)
  })
})
