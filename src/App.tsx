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

function CardView({ card, dest, onClick, onDoubleClick, selected, draggable, onDragStart, onDragEnd }: {
  card: Card | null
  dest: Destination
  onClick?: (e?: React.MouseEvent) => void
  onDoubleClick?: (e?: React.MouseEvent) => void
  selected?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
}) {
  if (!card) return <div className="card-slot" onClick={onClick as any} onDoubleClick={onDoubleClick as any} />
  if (!card.faceUp) {
    return <div className={`card back pattern-${dest.pattern}`} style={{'--p': dest.primary, '--s': dest.secondary} as any} onClick={onClick as any} onDoubleClick={onDoubleClick as any}>
      <span className="back-emoji">{dest.emoji}</span>
    </div>
  }
  const color = cardColor(card.suit)
  return <div className={`card ${color} ${selected ? 'selected' : ''}`} onClick={onClick as any} onDoubleClick={onDoubleClick as any} draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}>
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

const LS_DRAW = 'ps_drawCount'
function getDrawCount(): 1 | 3 {
  const v = parseInt(localStorage.getItem(LS_DRAW) || '1', 10)
  return v === 3 ? 3 : 1
}

type DrawCount = 1 | 3

const LS_AUTO = 'ps_autoFoundation'
function getAutoFoundation(): boolean {
  const v = localStorage.getItem(LS_AUTO)
  return v === null ? true : v === '1'
}

export default function App() {
  const [miles, setMiles] = useState(getMiles())
  const [stamps, setStamps] = useState(getStamps())
  const unlocked = DESTINATIONS.filter(d => d.milesRequired <= miles)
  const [destId, setDestId] = useState(unlocked[0]?.id || 'tokyo')
  const dest = DESTINATIONS.find(d => d.id === destId)!
  const [drawCount, setDrawCount] = useState<DrawCount>(getDrawCount())
  const [autoFoundation, setAutoFoundation] = useState(getAutoFoundation())

  const [state, setState] = useState<GameState>(() => dealNewGame(destId))
  const [history, setHistory] = useState<GameState[]>([])
  const [selected, setSelected] = useState<Selected | null>(null)
  const [passportOpen, setPassportOpen] = useState(false)
  const [won, setWon] = useState(false)
  const gameStart = useRef(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)

  const dragJustEnded = useRef(false)

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
    if (autoFoundation) autoFoundationFlip(s)
    flipExposed(s)
    return s
  }

  // try to send a tableau top card directly to its foundation
  // returns true if a move was made
  function trySendTableauToFoundation(p: number, idx: number): boolean {
    const pile = state.tableau[p]
    const card = pile[idx]
    if (!card?.faceUp) return false
    // only the top card of a tableau pile can go to foundation
    if (idx !== pile.length - 1) return false
    if (!canStackOnFoundation(card, state.foundations[card.suit])) return false
    pushHistory(state)
    const ns: GameState = structuredClone(state)
    const c = ns.tableau[p].pop()!
    ns.foundations[c.suit].push(c)
    ns.moves++
    const final = finalizeMove(ns)
    setState(final)
    setSelected(null)
    checkWin(final)
    return true
  }

  function trySendWasteToFoundation(): boolean {
    if (state.waste.length === 0) return false
    const card = state.waste[state.waste.length - 1]
    if (!canStackOnFoundation(card, state.foundations[card.suit])) return false
    pushHistory(state)
    const ns = structuredClone(state)
    const c = ns.waste.pop()!
    ns.foundations[c.suit].push(c)
    ns.moves++
    const final = finalizeMove(ns)
    setState(final)
    setSelected(null)
    checkWin(final)
    return true
  }

  // --- drag helpers ---
  function canDragTableauCard(p: number, idx: number): boolean {
    const pile = state.tableau[p]
    const card = pile[idx]
    if (!card?.faceUp) return false
    for (let i = idx; i < pile.length - 1; i++) {
      const a = pile[i], b = pile[i + 1]
      if (cardColor(a.suit) === cardColor(b.suit) || RANK_VALUE[a.rank] !== RANK_VALUE[b.rank] + 1) return false
    }
    return true
  }

  function moveSelectedToTableau(p: number): boolean {
    if (!selected) return false
    const pile = state.tableau[p]
    if (selected.source === 'waste') {
      const wasteCard = state.waste[state.waste.length - 1]
      if (!wasteCard) { setSelected(null); return false }
      const targetTop = pile[pile.length - 1] || null
      if (!canStackOnTableau(wasteCard, targetTop)) { setSelected(null); return false }
      pushHistory(state)
      const ns: GameState = structuredClone(state)
      const c = ns.waste.pop()!
      ns.tableau[p].push(c)
      ns.moves++
      const final = finalizeMove(ns)
      setState(final); setSelected(null); checkWin(final)
      return true
    } else {
      // tableau -> tableau
      if (selected.pile === p) { setSelected(null); return false }
      const srcPile = state.tableau[selected.pile]
      const moving = srcPile.slice(selected.idx)
      if (!moving.length) { setSelected(null); return false }
      const targetTop = pile[pile.length - 1] || null
      if (!canStackOnTableau(moving[0], targetTop)) { setSelected(null); return false }
      pushHistory(state)
      const ns: GameState = structuredClone(state)
      const src = ns.tableau[selected.pile]
      const dst = ns.tableau[p]
      const block = src.splice(selected.idx)
      dst.push(...block)
      ns.moves++
      const final = finalizeMove(ns)
      setState(final); setSelected(null); checkWin(final)
      return true
    }
  }

  function moveSelectedToFoundation(suit: Suit): boolean {
    if (!selected) return false
    if (selected.source === 'waste') {
      const wasteCard = state.waste[state.waste.length - 1]
      if (!wasteCard || wasteCard.suit !== suit) { setSelected(null); return false }
      if (!canStackOnFoundation(wasteCard, state.foundations[suit])) { setSelected(null); return false }
      pushHistory(state)
      const ns: GameState = structuredClone(state)
      const c = ns.waste.pop()!
      ns.foundations[suit].push(c)
      ns.moves++
      const final = finalizeMove(ns)
      setState(final); setSelected(null); checkWin(final)
      return true
    } else {
      const srcPile = state.tableau[selected.pile]
      const moving = srcPile.slice(selected.idx)
      if (moving.length !== 1) { setSelected(null); return false }
      const card = moving[0]
      if (card.suit !== suit) { setSelected(null); return false }
      if (!canStackOnFoundation(card, state.foundations[suit])) { setSelected(null); return false }
      pushHistory(state)
      const ns: GameState = structuredClone(state)
      ns.tableau[selected.pile].pop()!
      ns.foundations[suit].push(card)
      ns.moves++
      const final = finalizeMove(ns)
      setState(final); setSelected(null); checkWin(final)
      return true
    }
  }

  function clickTableau(p: number, idx: number) {
    if (dragJustEnded.current) { dragJustEnded.current = false; return }
    const pile = state.tableau[p]
    const card = pile[idx]
    // if something is selected, try to move it here
    if (selected) {
      const moved = moveSelectedToTableau(p)
      if (!moved) setSelected(null)
      return
    }
    // no selection – try to select this card
    if (!canDragTableauCard(p, idx)) return
    setSelected({ source: 'tableau', pile: p, idx })
  }

  function clickFoundation(suit: Suit) {
    if (!selected) return
    const moved = moveSelectedToFoundation(suit)
    if (!moved) setSelected(null)
  }

  // drag handlers
  function handleTableauDragStart(e: React.DragEvent, p: number, idx: number) {
    e.stopPropagation()
    if (!canDragTableauCard(p, idx)) { e.preventDefault(); return }
    setSelected({ source: 'tableau', pile: p, idx })
    e.dataTransfer.effectAllowed = 'move'
    // Firefox requires setData for drag to work
    try { e.dataTransfer.setData('text/plain', `tableau:${p}:${idx}`) } catch {}
  }
  function handleWasteDragStart(e: React.DragEvent) {
    e.stopPropagation()
    if (state.waste.length === 0) { e.preventDefault(); return }
    setSelected({ source: 'waste' })
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', 'waste') } catch {}
  }
  function handleDragEnd() {
    dragJustEnded.current = true
    setTimeout(() => { dragJustEnded.current = false }, 0)
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  function handleTableauDrop(e: React.DragEvent, p: number) { e.preventDefault(); e.stopPropagation(); moveSelectedToTableau(p) }
  function handleFoundationDrop(e: React.DragEvent, suit: Suit) { e.preventDefault(); e.stopPropagation(); moveSelectedToFoundation(suit) }

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
    for (let i = 0; i < drawCount && ns.stock.length > 0; i++) {
      const card = ns.stock.pop()!
      card.faceUp = true; ns.waste.push(card)
    }
    ns.moves++
    setState(ns)
  }

  function clickWaste() {
    if (dragJustEnded.current) { dragJustEnded.current = false; return }
    if (state.waste.length === 0) return
    // if waste card is already selected, clicking again deselects
    if (selected?.source === 'waste') {
      setSelected(null)
      return
    }
    // select the waste card so it can be played to tableau / dragged
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

  // destination background
  useEffect(() => {
    if ((dest as any).bg) {
      document.body.style.backgroundImage = `linear-gradient(rgba(232,227,214,0.88), rgba(232,227,214,0.88)), url(${(dest as any).bg})`
      document.body.style.backgroundSize = 'cover'
      document.body.style.backgroundPosition = 'center'
      document.body.style.backgroundAttachment = 'fixed'
    } else {
      document.body.style.backgroundImage = ''
    }
    return () => { document.body.style.backgroundImage = '' }
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
          <div className="waste-area" onDoubleClick={(e) => { e.stopPropagation(); trySendWasteToFoundation() }} style={drawCount === 3 ? { minWidth: 160, position: 'relative' } : undefined}>
            {state.waste.length === 0 ? <div className="card-slot" onClick={clickWaste} /> : drawCount === 1 ? (
              <CardView card={state.waste[state.waste.length-1]} dest={dest} selected={selected?.source === 'waste'} onClick={clickWaste} onDoubleClick={(e?: any) => { e?.stopPropagation?.(); trySendWasteToFoundation() }} draggable={true} onDragStart={handleWasteDragStart} onDragEnd={handleDragEnd} />
            ) : (
              state.waste.slice(Math.max(0, state.waste.length - 3)).map((card, i, arr) => (
                <div key={card.id} style={{ position: 'absolute', left: i * 28, zIndex: i, pointerEvents: i === arr.length - 1 ? 'auto' : 'none' }}>
                  <CardView card={card} dest={dest} selected={selected?.source === 'waste' && i === arr.length - 1} onClick={i === arr.length - 1 ? clickWaste : undefined} onDoubleClick={(e?: any) => { e?.stopPropagation?.(); if (i === arr.length - 1) trySendWasteToFoundation() }} draggable={i === arr.length - 1} onDragStart={i === arr.length - 1 ? handleWasteDragStart : undefined} onDragEnd={i === arr.length - 1 ? handleDragEnd : undefined} />
                </div>
              ))
            )}
          </div>
        </div>
        <div className="foundations">
          {(Object.keys(state.foundations) as Suit[]).map(s => {
            const pile = state.foundations[s]
            const top = pile[pile.length - 1] || null
            return <div key={s} className="foundation-slot" onClick={() => clickFoundation(s)} onDragOver={handleDragOver} onDrop={e => handleFoundationDrop(e, s)}>
              {top ? <CardView card={top} dest={dest} /> : <div className="foundation-empty">{SUIT_SYM[s]}</div>}
            </div>
          })}
        </div>
      </div>

      <div className="tableau">
        {state.tableau.map((pile, p) => {
          const n = pile.length
          // compress long piles so the board doesn't jump / overflow
          const gapUp = n > 20 ? 8 : n > 16 ? 10 : n > 12 ? 13 : n > 8 ? 16 : 20
          const gapDown = n > 20 ? 14 : n > 16 ? 18 : n > 12 ? 24 : n > 8 ? 32 : 44
          return (
          <div key={p} className="tableau-pile" onClick={() => { if (pile.length === 0 && selected) clickTableau(p, 0) }} onDragOver={handleDragOver} onDrop={e => handleTableauDrop(e, p)}>
            {pile.length === 0
              ? <div className="card-slot" onClick={() => clickTableau(p, 0)} onDragOver={handleDragOver} onDrop={e => handleTableauDrop(e, p)} />
              : pile.map((card, i) => (
                <div key={card.id} style={{ marginTop: i === 0 ? 0 : card.faceUp ? -gapUp : -gapDown }}>
                  <CardView
                    card={card}
                    dest={dest}
                    selected={selected?.source === 'tableau' && selected.pile === p && selected.idx <= i}
                    onClick={e => { e?.stopPropagation(); clickTableau(p, i) }}
                    onDoubleClick={e => { e?.stopPropagation(); trySendTableauToFoundation(p, i) }}
                    draggable={canDragTableauCard(p, i)}
                    onDragStart={e => handleTableauDragStart(e, p, i)}
                    onDragEnd={handleDragEnd}
                  />
                </div>
              ))
            }
          </div>
        )})}
      </div>

      <div className="footer-bar">
        <button className="btn-ghost" onClick={undo} disabled={history.length === 0} style={{opacity: history.length === 0 ? 0.5 : 1}}>↶ Undo</button>
        <button className="btn-ghost" onClick={newDeal}>New Deal</button>
        <button className="btn-ghost" onClick={() => {
          const next: DrawCount = drawCount === 1 ? 3 : 1
          setDrawCount(next)
          localStorage.setItem(LS_DRAW, String(next))
        }} title="Toggle draw 1 / draw 3">
          Draw: {drawCount}
        </button>
        <button className="btn-ghost" onClick={() => {
          const next = !autoFoundation
          setAutoFoundation(next)
          localStorage.setItem(LS_AUTO, next ? '1' : '0')
        }} title="Auto-send cards to foundations">
          Auto: {autoFoundation ? 'On' : 'Off'}
        </button>
        <span className="footer-hint">Drag cards or click to select{autoFoundation ? ' • Cards auto-send to foundations' : ''}</span>
      </div>

      <PassportBook open={passportOpen} onClose={() => setPassportOpen(false)} stamps={stamps} miles={miles} />
      {won && <WinStamp dest={dest} onClose={() => setWon(false)} timeMs={elapsedMs} moves={state.moves} />}
    </div>
  )
}
