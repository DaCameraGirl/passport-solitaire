import { useState, useEffect, useRef } from 'react'
import type { Card, GameState, Suit, Destination } from './game/types'
import { cardColor, canStackOnTableau, canStackOnFoundation, RANK_VALUE } from './game/types'
import { dealNewGame, isWon, getMiles, addMiles, getStamps, addStamp } from './game/engine'
import { DESTINATIONS } from './game/destinations'
import './App.css'

const SUIT_SYM: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }

function formatTime(ms: number) {
  const sec = Math.floor(ms / 1000)
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

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
  return <div className="win-overlay" onClick={onClose}>
    <div className="win-card" onClick={e => e.stopPropagation()}>
      <div className="win-stamp-ring" style={{borderColor: dest.primary}}>
        <div className="win-stamp-glyph">{dest.emoji}</div>
      </div>
      <h2>Destination stamped!</h2>
      <p className="win-city">{dest.city}, {dest.country}</p>
      <p className="win-meta">{formatTime(timeMs)} • {moves} moves • +250 miles</p>
      <button className="btn-primary" onClick={onClose}>Continue ✈️</button>
    </div>
  </div>
}

type Selected = { source: 'tableau', pile: number, idx: number } | { source: 'waste' }

export default function App() {
  const [miles, setMiles] = useState(getMiles())
  const [stamps, setStamps] = useState(getStamps())
  const unlocked = DESTINATIONS.filter(d => d.milesRequired <= miles)
  const [destId, setDestId] = useState(unlocked[0]?.id || 'tokyo')
  const dest = DESTINATIONS.find(d => d.id === destId)!

  const [state, setState] = useState<GameState>(() => dealNewGame(destId))
  const [history, setHistory] = useState<GameState[]>([])
  const [selected, setSelected] = useState<Selected | null>(null)
  const [passportOpen, setPassportOpen] = useState(false)
  const [won, setWon] = useState(false)
  const gameStart = useRef(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    setState(dealNewGame(destId))
    setSelected(null)
    setHistory([])
    setWon(false)
    gameStart.current = Date.now()
    setElapsedMs(0)
  }, [destId])

  useEffect(() => {
    if (won) return
    const id = setInterval(() => setElapsedMs(Date.now() - gameStart.current), 250)
    return () => clearInterval(id)
  }, [won, destId])

  function pushHistory(s: GameState) {
    setHistory(h => [...h.slice(-49), structuredClone(s)])
  }

  function undo() {
    setHistory(h => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setState(prev)
      setSelected(null)
      setWon(false)
      return h.slice(0, -1)
    })
  }

  function newDeal() {
    setState(dealNewGame(destId))
    setHistory([])
    setWon(false)
    setSelected(null)
    gameStart.current = Date.now()
    setElapsedMs(0)
  }

  function flipExposed(s: GameState) {
    for (const pile of s.tableau) {
      if (pile.length && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true
      }
    }
  }

  function autoFoundationFlip(s: GameState) {
    let changed: boolean
    do {
      changed = false
      for (let p = 0; p < 7; p++) {
        const pile = s.tableau[p]
        if (pile.length === 0) continue
        const card = pile[pile.length - 1]
        if (!card.faceUp) continue
        if (canStackOnFoundation(card, s.foundations[card.suit])) {
          s.foundations[card.suit].push(pile.pop()!)
          changed = true
        }
      }
      if (changed) flipExposed(s)
    } while (changed)
    return s
  }

  function finalizeMove(s: GameState) {
    flipExposed(s)
    autoFoundationFlip(s)
    flipExposed(s)
    return s
  }

  function clickTableau(p: number, idx: number) {
    const pile = state.tableau[p]
    const card = pile[idx]

    // Try to drop selected cards here first (handles empty piles)
    if (selected) {
      if (selected.source === 'waste') {
        const wasteCard = state.waste[state.waste.length - 1]
        if (!wasteCard) { setSelected(null); return }
        const targetTop = pile[pile.length - 1] || null
        if (canStackOnTableau(wasteCard, targetTop)) {
          pushHistory(state)
          const ns: GameState = structuredClone(state)
          const c = ns.waste.pop()!
          ns.tableau[p].push(c)
          ns.moves++
          const final = finalizeMove(ns)
          setState(final)
          setSelected(null)
          checkWin(final)
          return
        }
        setSelected(null)
        return
      }

      // selected.source === 'tableau'
      // clicking the selected card again = deselect
      if (selected.pile === p && selected.idx === idx) {
        setSelected(null)
        return
      }
      const srcPile = state.tableau[selected.pile]
      const moving = srcPile.slice(selected.idx)
      if (moving.length) {
        const targetTop = pile[pile.length - 1] || null
        if (canStackOnTableau(moving[0], targetTop)) {
          pushHistory(state)
          const ns: GameState = structuredClone(state)
          const src = ns.tableau[selected.pile]
          const dst = ns.tableau[p]
          const block = src.splice(selected.idx)
          dst.push(...block)
          ns.moves++
          const final = finalizeMove(ns)
          setState(final)
          setSelected(null)
          checkWin(final)
          return
        }
      }
      setSelected(null)
      return
    }

    // No selection active – trying to select a card
    if (!card?.faceUp) return

    // Validate this is a movable sequence
    for (let i = idx; i < pile.length - 1; i++) {
      const a = pile[i], b = pile[i + 1]
      if (cardColor(a.suit) === cardColor(b.suit) || RANK_VALUE[a.rank] !== RANK_VALUE[b.rank] + 1) return
    }
    setSelected({ source: 'tableau', pile: p, idx })
  }

  function clickFoundation(suit: Suit) {
    if (!selected) return

    if (selected.source === 'waste') {
      const wasteCard = state.waste[state.waste.length - 1]
      if (!wasteCard || wasteCard.suit !== suit) { setSelected(null); return }
      if (!canStackOnFoundation(wasteCard, state.foundations[suit])) { setSelected(null); return }
      pushHistory(state)
      const ns: GameState = structuredClone(state)
      const c = ns.waste.pop()!
      ns.foundations[suit].push(c)
      ns.moves++
      const final = finalizeMove(ns)
      setState(final)
      setSelected(null)
      checkWin(final)
      return
    }

    // tableau -> foundation
    const srcPile = state.tableau[selected.pile]
    const moving = srcPile.slice(selected.idx)
    if (moving.length !== 1) { setSelected(null); return }
    const card = moving[0]
    if (card.suit !== suit) { setSelected(null); return }
    if (!canStackOnFoundation(card, state.foundations[suit])) { setSelected(null); return }
    pushHistory(state)
    const ns: GameState = structuredClone(state)
    ns.tableau[selected.pile].pop()!
    ns.foundations[suit].push(card)
    ns.moves++
    const final = finalizeMove(ns)
    setState(final); setSelected(null); checkWin(final)
  }

  function drawStock() {
    if (state.stock.length === 0) {
      if (state.waste.length === 0) return
      pushHistory(state)
      const ns = structuredClone(state)
      ns.stock = ns.waste.reverse().map(c => ({ ...c, faceUp: false }))
      ns.waste = []; ns.moves++
      setState(ns); return
    }
    pushHistory(state)
    setSelected(null)
    const ns = structuredClone(state)
    const card = ns.stock.pop()!
    card.faceUp = true; ns.waste.push(card); ns.moves++
    setState(ns)
  }

  function clickWaste() {
    if (state.waste.length === 0) return
    const card = state.waste[state.waste.length - 1]

    // if waste card is already selected, clicking again deselects
    if (selected?.source === 'waste') {
      setSelected(null)
      return
    }

    // auto-send to foundation if possible
    if (canStackOnFoundation(card, state.foundations[card.suit])) {
      pushHistory(state)
      const ns = structuredClone(state)
      const c = ns.waste.pop()!
      ns.foundations[c.suit].push(c); ns.moves++
      const final = finalizeMove(ns)
      setState(final); checkWin(final)
      return
    }

    // otherwise select the waste card so it can be played to tableau
    setSelected({ source: 'waste' })
  }

  function checkWin(s: GameState) {
    if (isWon(s) && !won) {
      const elapsed = Date.now() - gameStart.current
      addStamp(dest.id, elapsed)
      addMiles(250)
      setStamps(getStamps()); setMiles(getMiles())
      setWon(true); setElapsedMs(elapsed)
      setHistory([]) // clear undo after win
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const o = ctx.createOscillator(); const g = ctx.createGain()
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

  const destOptions = DESTINATIONS.map(d => ({ ...d, unlocked: miles >= d.milesRequired }))

  // Paris Eiffel Tower background
  useEffect(() => {
    if (destId === 'paris') {
      document.body.classList.add('paris-bg')
    } else {
      document.body.classList.remove('paris-bg')
    }
    return () => { document.body.classList.remove('paris-bg') }
  }, [destId])

  return (
    <div className={`wrap dest-${destId}`} style={{'--dest-primary': dest.primary, '--dest-secondary': dest.secondary, '--dest-accent': dest.accent} as any}>
      <header className="boarding-pass">
        <div className="bp-left">
          <div className="bp-brand">PASSPORT SOLITAIRE</div>
          <div className="bp-route">{dest.city} → VICTORY</div>
        </div>
        <div className="bp-mid">
          <span>⏱ {formatTime(elapsedMs)}</span>
          <span>FLT {state.moves}</span>
          <span>MI {miles.toLocaleString()}</span>
        </div>
        <div className="bp-right">
          <button className="passport-btn" onClick={() => setPassportOpen(true)}>🛂 Passport</button>
        </div>
      </header>

      <div className="dest-picker">
        {destOptions.map(d => (
          <button key={d.id} className={`dest-chip ${d.id === destId ? 'active' : ''} ${!d.unlocked ? 'locked' : ''}`}
            onClick={() => d.unlocked && setDestId(d.id)} disabled={!d.unlocked} style={{borderColor: d.primary}}>
            <span>{d.emoji}</span> {d.city}
            {!d.unlocked && <small> {d.milesRequired}mi</small>}
          </button>
        ))}
      </div>

      <div className="top-row">
        <div className="stock-waste">
          <div className="stock-area" onClick={drawStock}>
            {state.stock.length ? <div className={`card back pattern-${dest.pattern}`} style={{'--p': dest.primary, '--s': dest.secondary} as any}><span className="back-emoji">{dest.emoji}</span></div> : <div className="card-slot">↻</div>}
            <span className="count-badge">{state.stock.length}</span>
          </div>
          <div className="waste-area" onClick={clickWaste}>
            {state.waste.length ? <CardView card={state.waste[state.waste.length-1]} dest={dest} selected={selected?.source === 'waste'} /> : <div className="card-slot" />}
          </div>
        </div>
        <div className="foundations">
          {(Object.keys(state.foundations) as Suit[]).map(s => {
            const pile = state.foundations[s]
            const top = pile[pile.length - 1] || null
            return <div key={s} className="foundation-slot" onClick={() => clickFoundation(s)}>
              {top ? <CardView card={top} dest={dest} /> : <div className="foundation-empty">{SUIT_SYM[s]}</div>}
            </div>
          })}
        </div>
      </div>

      <div className="tableau">
        {state.tableau.map((pile, p) => {
          const n = pile.length
          // compress long piles so the board doesn't jump
          const gapUp = n > 16 ? 10 : n > 12 ? 13 : n > 8 ? 16 : 18
          const gapDown = n > 16 ? 18 : n > 12 ? 24 : n > 8 ? 32 : 44
          return (
          <div key={p} className="tableau-pile" onClick={() => { if (pile.length === 0 && selected) clickTableau(p, 0) }}>
            {pile.length === 0
              ? <div className="card-slot" onClick={() => clickTableau(p, 0)} />
              : pile.map((card, i) => (
                <div key={card.id} style={{ marginTop: i === 0 ? 0 : card.faceUp ? -gapUp : -gapDown }} onClick={e => { e.stopPropagation(); clickTableau(p, i) }}>
                  <CardView card={card} dest={dest} selected={selected?.source === 'tableau' && selected.pile === p && selected.idx <= i} />
                </div>
              ))
            }
          </div>
        )})}
      </div>

      <div className="footer-bar">
        <button className="btn-ghost" onClick={undo} disabled={history.length === 0} style={{opacity: history.length === 0 ? 0.5 : 1}}>↶ Undo</button>
        <button className="btn-ghost" onClick={newDeal}>New Deal</button>
        <span className="footer-hint">Click a card to select, then click where to move • Cards auto-send to foundations</span>
      </div>

      <PassportBook open={passportOpen} onClose={() => setPassportOpen(false)} stamps={stamps} miles={miles} />
      {won && <WinStamp dest={dest} onClose={() => setWon(false)} timeMs={elapsedMs} moves={state.moves} />}
    </div>
  )
}
