export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  id: string
  suit: Suit
  rank: Rank
  faceUp: boolean
}

export interface Destination {
  id: string
  city: string
  country: string
  emoji: string
  primary: string
  secondary: string
  accent: string
  pattern: 'waves' | 'tiles' | 'stripes' | 'dots' | 'grid' | 'hex'
  milesRequired: number
  unlocked: boolean
  stampsEarned: number
}

export interface PassportStamp {
  destinationId: string
  date: string
  time: number
}

export interface GameState {
  tableau: Card[][]
  foundations: Record<Suit, Card[]>
  stock: Card[]
  waste: Card[]
  destinationId: string
  moves: number
}

export const RANKS: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
export const SUITS: Suit[] = ['hearts','diamonds','clubs','spades']
export const RANK_VALUE: Record<Rank, number> = { A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13 }

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit}-${rank}`, suit, rank, faceUp: false })
    }
  }
  return deck
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cardColor(suit: Suit): 'red' | 'black' {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black'
}

export function canStackOnTableau(card: Card, target: Card | null): boolean {
  if (!target) return card.rank === 'K'
  return cardColor(card.suit) !== cardColor(target.suit)
    && RANK_VALUE[card.rank] === RANK_VALUE[target.rank] - 1
}

export function canStackOnFoundation(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === 'A'
  const top = pile[pile.length - 1]
  return top.suit === card.suit && RANK_VALUE[card.rank] === RANK_VALUE[top.rank] + 1
}
