// Pool cycles after 10 destinations — accepted behavior for Phase 2
const TRAVEL_EMOJIS = ['✈️', '🏖️', '🗺️', '🏔️', '🌴', '🗽', '🏯', '🌍', '🎒', '🚢']

export function assignEmoji(index: number): string {
  return TRAVEL_EMOJIS[index % TRAVEL_EMOJIS.length]
}
