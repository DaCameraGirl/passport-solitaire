# 🛂 Passport Solitaire

<p align="center">
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" />
  <img src="https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white" />
</p>

<p align="center">
  <b>Travel-themed Klondike solitaire — win hands, collect stamps, unlock the world.</b>
  <br/>
  <a href="https://dacameragirl.github.io/passport-solitaire/"><b>▶ Play it live</b></a>
</p>

---

<p align="center">
  <img src="./src/assets/hero.png" alt="Passport Solitaire" width="760" />
</p>

Each win earns a passport stamp and 250 flight miles toward unlocking new destinations. Six cities, six unique deck skins — Tokyo, Paris, Marrakech, Rio, Reykjavik, Bangkok.

---

## 🎮 How to Play

Passport Solitaire follows classic Klondike / Draw-Three rules with a travel twist.

### The Board

| Area | What it does |
|---|---|
| **Stock** (top-left) | Click to draw cards into the waste. Supports Draw 1 or Draw 3 mode. Recycles when empty. |
| **Waste** | Your drawn cards. Click a card to select it for tableau moves, or auto-send to foundations if possible. |
| **Foundations** (top-right, 4 slots) | Build A→K, same suit. Click a foundation slot to send a selected card there. |
| **Tableau** (7 piles) | Build descending (K→A), alternating red/black. Move single cards or full valid sequences. Empty tableau spots accept Kings only. Exposed cards auto-flip face-up. |

### Controls

- **Click a card** to select it — valid moves highlight. Click again to deselect.
- **Click a destination slot** (foundation or tableau pile) to drop your selected card(s).
- **Stock/Waste:** click the stock to draw. Click a waste card to auto-send to foundation if legal, otherwise select it for a tableau move.
- **Draw mode:** toggle Draw 1 / Draw 3 from the footer bar. Saved in `localStorage`.
- **Auto-foundation:** toggle on/off in the footer. When on, any tableau card that can legally go to a foundation is sent automatically after every move. Also saved in `localStorage`.

### Win Condition

Fill all four foundations (A→K of each suit). You get:

- 🛂 a passport stamp for the current destination
- ✈️ +250 flight miles
- ⏱️ your completion time and move count recorded on the win screen

---

## 🌍 Destinations

Each destination has its own color palette, card-back pattern, emoji, and full-screen background photo.

| Destination | Emoji | Card Back | Miles to Unlock |
|---|---|---|---|
| Tokyo, Japan | ⛩️ | Waves | Unlocked |
| Paris, France | 🗼 | Grid | Unlocked |
| Marrakech, Morocco | 🕌 | Tiles | 800 mi |
| Rio, Brazil | 🏖️ | Dots | 1,500 mi |
| Reykjavik, Iceland | 🏔️ | Hex | 2,500 mi |
| Bangkok, Thailand | 🛕 | Stripes | 3,800 mi |

Switch destinations any time from the chip row below the boarding pass header. Locked cities show their mile requirement. Stamps and miles persist in `localStorage`.

---

## ✨ Animations & Polish

- 🎴 **Hover lift** — cards nudge up `translateY(-2px)` on hover with a smooth `.08s` transition
- 🛂 **Stamp pop** — win screen animates in with a `stamp-pop` keyframe: scales from 60% with a `-8°` rotation snap, `.38s cubic-bezier(.34,1.56,.64,1)`
- 🔄 **Pile compression** — long tableau piles automatically compress their card spacing so the board never overflows or jumps (`gapUp` / `gapDown` scaling at 8 / 12 / 16 / 20+ cards)
- 📱 **Responsive cards** — card size scales from 78×108px desktop down to 46×66px on mobile
- 🌆 **Destination backgrounds** — each city brings its own full-bleed Unsplash background with a warm paper-tone overlay
- 🔊 **Win sound** — Web Audio API "thunk-stamp" tone on victory (sine sweep 180Hz → 70Hz, 0.18s decay); haptic vibrate on supported mobile devices
- 🎯 **Selected card outline** — selected cards get a 3px outline in the destination's primary color
- 🌊 **6 unique card-back patterns** — waves, tiles, grid, dots, stripes, and hex, each tinted in the destination's colorway

> 🎬 Gameplay GIFs coming soon — win stamp animation, destination switching, card moves.

---

## 📋 Features

- ✅ Passport booklet with earned stamps + locked silhouettes
- ✅ City-themed deck skins with unique patterns & color palettes
- ✅ Destination background photos per city
- ✅ Boarding-pass stats header (timer, move count / "FLT", total miles)
- ✅ Draw 1 / Draw 3 toggle (persistent)
- ✅ Auto-foundation toggle (persistent)
- ✅ Undo — up to 50 moves of history
- ✅ Click-to-select / click-to-move
- ✅ Win stamp screen with time + move count
- ✅ Mobile-responsive layout
- 🟡 World map progression (planned)
- 🟡 Luggage-tag / postcard-style foundations (planned)
- 🟡 Layover bonus modes (planned)
- 🟡 Postcard-flip card animations (planned)

---

## 🚀 Play Locally

```powershell
npm install
npm run dev
```

Build for production:

```powershell
npm run build
```

---

<p align="center">
  Built with <b>Vite + React + TypeScript</b>
  <br/>
  🛂 ✈️ 🗺️
</p>
