import type { Card, GameState, Suit, PassportStamp } from './types'
import { createDeck, shuffle, SUITS } from './types'

const DEAL_COUNTS = [1, 2, 3, 4, 5, 6, 7]

export function dealNewGame(destinationId: string): GameState {
  const deck = shuffle(createDeck())
  const tableau: Card[][] = [[], [], [], [], [], [], []]
  let idx = 0
  for (let pile = 0; pile < 7; pile++) {
    for (let n = 0; n < DEAL_COUNTS[pile]; n++) {
      const card = { ...deck[idx++] }
      card.faceUp = n === DEAL_COUNTS[pile] - 1
      tableau[pile].push(card)
    }
  }
  const stock = deck.slice(idx).map(c => ({ ...c, faceUp: false }))
  return {
    tableau,
    foundations: { hearts: [], diamonds: [], clubs: [], spades: [] } as Record<Suit, Card[]>,
    stock,
    waste: [],
    destinationId,
    moves: 0,
  }
}

export function isWon(state: GameState): boolean {
  return SUITS.every(s => state.foundations[s].length === 13)
}

/* --- persistence --- */

const LS_MILES = 'ps_miles'
const LS_STAMPS = 'ps_stamps'

export function getMiles(): number {
  return parseInt(localStorage.getItem(LS_MILES) || '0', 10)
}

export function addMiles(n: number) {
  localStorage.setItem(LS_MILES, String(getMiles() + n))
}

export function getStamps(): PassportStamp[] {
  try { return JSON.parse(localStorage.getItem(LS_STAMPS) || '[]') } catch { return [] }
}

export function addStamp(destinationId: string, timeMs: number) {
  const stamps = getStamps()
  stamps.push({ destinationId, date: new Date().toISOString(), time: timeMs })
  localStorage.setItem(LS_STAMPS, JSON.stringify(stamps))
}
