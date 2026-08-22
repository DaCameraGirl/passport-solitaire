import { useState, useEffect, useRef } from 'react'
import type { Card, GameState, Suit, Destination } from './game/types'
import { cardColor, canStackOnTableau, canStackOnFoundation, RANK_VALUE } from './game/types'
import { dealNewGame, isWon, getMiles, addMiles, getStamps, addStamp } from './game/engine'
import { DESTINATIONS } from './game/destinations'
import './App.css'

const SUIT_SYM: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }

function CardView({ card, dest, onClick, selected }: {
  card: Card | null
  dest: Destination
  onClick?: () => void
  selected?: boolean
}) {
  if (!card) return <div className="card-slot" onClick={onClick} />
  if (!card.faceUp) {
    return <div className={`card back pattern-${dest.pattern}`} style={{'--p': dest.primary, '--s': dest.secondary} as any} onClick={onClick}>
      <span className="back-emoji">{dest.emoji}</span>
    </div>
  }
  const color = cardColor(card.suit)
  return <div className={`card ${color} ${selected ? 'selected' : ''}`} onClick={onClick}>
    <div className="card-corner">
      <b>{card.rank}</b>
      <span>{SUIT_SYM[card.suit]}</span>
    </div>
    <div className="card-center">{SUIT_SYM[card.suit]}</div>
  </div>
}

function PassportBook({ open, onClose, stamps, miles }: {
  open: boolean, onClose: () => void,
  stamps: ReturnType<typeof getStamps>, miles: number
}) {
  if (!open) return null
  const stampCounts = new Map<string, number>()
  for (const s of stamps) stampCounts.set(s.destinationId, (stampCounts.get(s.destinationId) || 0) + 1)

  const unlocked = DESTINATIONS.filter(d => {
    if (d.milesRequired === 0) return true
    return miles >= d.milesRequired
  })

  return <div className="passport-overlay" onClick={onClose}>
    <div className="passport-book" onClick={e => e.stopPropagation()}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <h2>🛂 Passport</h2>
      <p className="miles">{miles.toLocaleString()} miles flown</p>
      <div className="stamps-grid">
        {DESTINATIONS.map(d => {
          const count = stampCounts.get(d.id) || 0
          const isUnlocked = unlocked.some(u => u.id === d.id)
          return <div key={d.id} className={`stamp ${isUnlocked ? '' : 'locked'}`}>
            <div className="stamp-circle" style={{ borderColor: d.primary, background: d.secondary }}>
              {isUnlocked ? d.emoji : '🔒'}
            </div>
            <div className="stamp-label">
              <b>{d.city}</b><br/>
              {isUnlocked
                ? (count > 0 ? `${count} stamp${count>1?'s':''}` : '— 0 stamps')
                : `${d.milesRequired.toLocaleString()} mi to unlock`}
            </div>
          </div>
        })}
      </div>
    </div>
  </div>
}

function WinStamp({ dest, onClose, timeMs, moves }: {
  dest: Destination, onClose: () => void, timeMs: number, moves: number
}) {
  const sec = Math.round(timeMs / 1000)
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return <div className="win-overlay" onClick={onClose}>
    <div className="win-card" onClick={e => e.stopPropagation()}>
      <div className="win-stamp-ring" style={{borderColor: dest.primary}}>
        <div className="win-stamp-glyph">{dest.emoji}</div>
      </div>
      <h2>Destination stamped!</h2>
      <p className="win-city">{dest.city}, {dest.country}</p>
      <p className="win-meta">{mm}:{ss} • {moves} moves • +250 miles</p>
      <button className="btn-primary" onClick={onClose}>Continue ✈️</button>
    </div>
  </div>
}

export default function App() {
  const [miles, setMiles] = useState(getMiles())
  const [stamps, setStamps] = useState(getStamps())
  const unlocked = DESTINATIONS.filter(d => d.milesRequired <= miles)
  const [destId, setDestId] = useState(unlocked[0]?.id || 'tokyo')
  const dest = DESTINATIONS.find(d => d.id === destId)!

  const [state, setState] = useState<GameState>(() => dealNewGame(destId))
  const [selected, setSelected] = useState<{ pile: number, idx: number } | null>(null)
  const [passportOpen, setPassportOpen] = useState(false)
  const [won, setWon] = useState(false)
  const gameStart = useRef(Date.now())

  useEffect(() => {
    setState(dealNewGame(destId))
    setSelected(null)
    setWon(false)
    gameStart.current = Date.now()
  }, [destId])

  function autoFoundationFlip(s: GameState) {
    let changed: boolean
    const ns = structuredClone(s) as GameState
    do {
      changed = false
      for (let p = 0; p < 7; p++) {
        const pile = ns.tableau[p]
        if (pile.length === 0) continue
        const card = pile[pile.length - 1]
        if (!card.faceUp) continue
        if (canStackOnFoundation(card, ns.foundations[card.suit])) {
          ns.foundations[card.suit].push(pile.pop()!)
          changed = true
        }
      }
    } while (changed)
    return ns
  }

  function flipExposed(s: GameState) {
    for (const pile of s.tableau) {
      if (pile.length && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true
      }
    }
  }

  function clickTableau(p: number, idx: number) {
    const pile = state.tableau[p]
    const card = pile[idx]
    if (!card?.faceUp) return

    if (selected && selected.pile === p && selected.idx === idx) {
      setSelected(null); return
    }

    // trying to move selected cards here?
    if (selected) {
      const srcPile = state.tableau[selected.pile]
      const moving = srcPile.slice(selected.idx)
      if (moving.length) {
        const targetTop = pile[pile.length - 1] || null
        if (canStackOnTableau(moving[0], targetTop)) {
          const ns: GameState = structuredClone(state)
          const src = ns.tableau[selected.pile]
          const dst = ns.tableau[p]
          const block = src.splice(selected.idx)
          dst.push(...block)
          flipExposed(ns)
          ns.moves++
          const final = autoFoundationFlip(ns)
          setState(final)
          setSelected(null)
          checkWin(final)
          return
        }
      }
      setSelected(null)
      return
    }

    // validate this is a movable sequence
    for (let i = idx; i < pile.length - 1; i++) {
      const a = pile[i], b = pile[i + 1]
      if (cardColor(a.suit) === cardColor(b.suit) || RANK_VALUE[a.rank] !== RANK_VALUE[b.rank] + 1) return
    }
    setSelected({ pile: p, idx })
  }

  function clickFoundation(suit: Suit) {
    if (!selected) return
    const srcPile = state.tableau[selected.pile]
    const moving = srcPile.slice(selected.idx)
    if (moving.length !== 1) { setSelected(null); return }
    const card = moving[0]
    if (card.suit !== suit) { setSelected(null); return }
    if (!canStackOnFoundation(card, state.foundations[suit])) { setSelected(null); return }
    const ns: GameState = structuredClone(state)
    ns.tableau[selected.pile].pop()
    ns.foundations[suit].push(card)
    flipExposed(ns)
    ns.moves++
    const final = autoFoundationFlip(ns)
    setState(final)
    setSelected(null)
    checkWin(final)
  }

  function drawStock() {
    if (state.stock.length === 0) {
      if (state.waste.length === 0) return
      const ns = structuredClone(state)
      ns.stock = ns.waste.reverse().map(c => ({ ...c, faceUp: false }))
      ns.waste = []
      ns.moves++
      setState(ns)
      return
    }
    const ns = structuredClone(state)
    const card = ns.stock.pop()!
    card.faceUp = true
    ns.waste.push(card)
    ns.moves++
    setState(ns)
  }

  function clickWaste() {
    if (state.waste.length === 0) return
    const card = state.waste[state.waste.length - 1]
    if (canStackOnFoundation(card, state.foundations[card.suit])) {
      const ns = structuredClone(state)
      const c = ns.waste.pop()!
      ns.foundations[c.suit].push(c)
      ns.moves++
      const final = autoFoundationFlip(ns)
      setState(final)
      checkWin(final)
    }
  }

  function checkWin(s: GameState) {
    if (isWon(s) && !won) {
      const elapsed = Date.now() - gameStart.current
      addStamp(dest.id, elapsed)
      addMiles(250)
      setStamps(getStamps())
      setMiles(getMiles())
      setWon(true)
      // thunk!
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.setValueAtTime(180, ctx.currentTime)
        o.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.12)
        g.gain.setValueAtTime(0.35, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
        o.start(); o.stop(ctx.currentTime + 0.2)
      } catch {}
      if (navigator.vibrate) navigator.vibrate(40)
    }
  }

  const destOptions = DESTINATIONS.map(d => {
    const isU = miles >= d.milesRequired
    return { ...d, unlocked: isU }
  })

  return (
    <div className="wrap" style={{'--dest-primary': dest.primary, '--dest-secondary': dest.secondary, '--dest-accent': dest.accent} as any}>
      <header className="boarding-pass">
        <div className="bp-left">
          <div className="bp-brand">PASSPORT SOLITAIRE</div>
          <div className="bp-route">{dest.city} → VICTORY</div>
        </div>
        <div className="bp-mid">
          <span>FLT  {state.moves}</span>
          <span>MI  {miles.toLocaleString()}</span>
        </div>
        <div className="bp-right">
          <button className="passport-btn" onClick={() => setPassportOpen(true)}>🛂 Passport</button>
        </div>
      </header>

      <div className="dest-picker">
        {destOptions.map(d => (
          <button
            key={d.id}
            className={`dest-chip ${d.id === destId ? 'active' : ''} ${!d.unlocked ? 'locked' : ''}`}
            onClick={() => d.unlocked && setDestId(d.id)}
            disabled={!d.unlocked}
            style={{borderColor: d.primary}}
          >
            <span>{d.emoji}</span> {d.city}
            {!d.unlocked && <small> {d.milesRequired}mi</small>}
          </button>
        ))}
      </div>

      <div className="top-row">
        <div className="foundations">
          {(Object.keys(state.foundations) as Suit[]).map(s => {
            const pile = state.foundations[s]
            const top = pile[pile.length - 1] || null
            return <div key={s} className="foundation-slot" onClick={() => clickFoundation(s)}>
              {top ? <CardView card={top} dest={dest} /> : <div className="foundation-empty">{SUIT_SYM[s]}</div>}
            </div>
          })}
        </div>
        <div className="stock-waste">
          <div className="stock-area" onClick={drawStock}>
            {state.stock.length ? <div className={`card back pattern-${dest.pattern}`} style={{'--p': dest.primary, '--s': dest.secondary} as any}><span className="back-emoji">{dest.emoji}</span></div> : <div className="card-slot">↻</div>}
            <span className="count-badge">{state.stock.length}</span>
          </div>
          <div className="waste-area" onClick={clickWaste}>
            {state.waste.length ? <CardView card={state.waste[state.waste.length-1]} dest={dest} /> : <div className="card-slot" />}
          </div>
        </div>
      </div>

      <div className="tableau">
        {state.tableau.map((pile, p) => (
          <div key={p} className="tableau-pile" onClick={() => { if (pile.length === 0 && selected) clickTableau(p, 0) }}>
            {pile.length === 0
              ? <div className="card-slot" onClick={() => clickTableau(p, 0)} />
              : pile.map((card, i) => (
                <div key={card.id} style={{ marginTop: i === 0 ? 0 : card.faceUp ? -18 : -52 }} onClick={e => { e.stopPropagation(); clickTableau(p, i) }}>
                  <CardView card={card} dest={dest} selected={selected?.pile === p && selected.idx <= i} />
                </div>
              ))
            }
          </div>
        ))}
      </div>

      <div className="footer-bar">
        <button className="btn-ghost" onClick={() => { setState(dealNewGame(destId)); setWon(false); gameStart.current = Date.now() }}>New Deal</button>
        <span className="footer-hint">Click a card to select, then click where to move • Cards auto-send to foundations</span>
      </div>

      <PassportBook open={passportOpen} onClose={() => setPassportOpen(false)} stamps={stamps} miles={miles} />
      {won && <WinStamp dest={dest} onClose={() => setWon(false)} timeMs={Date.now() - gameStart.current} moves={state.moves} />}
    </div>
  )
}
