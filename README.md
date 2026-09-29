# 🎴 MTG Hand Simulator

Tool web per simulare la mano iniziale di Magic: The Gathering, con supporto per mulligan London style.

## 🚀 Funzionalità

- ✅ Importa mazzi da file .txt/.dek o copia/incolla (formati testo, Arena, MTGO)
- ✅ Visualizzazione delle carte con immagini da Scryfall
- ✅ Mano a ventaglio animata, dettagli delle carte, scorciatoie da tastiera (M, K, N, Invio)
- ✅ Pesca mano iniziale di 7 carte
- ✅ Mulligan London: Mulligan/Keep, poi scelta delle carte da mettere in fondo
- ✅ Analisi della mana base su richiesta:
  - fonti per colore rispetto alle soglie di Frank Karsten (fetch, dual, MDFC, Signet e dork inclusi)
  - warning su terre fuori colore, colori sotto soglia, terre tappate o incolori
  - numero di terre consigliato (formula di Karsten) e probabilità della mano iniziale
  - distribuzione ottimale delle terre base, applicabile al mazzo con un clic
  - simulazione Monte Carlo di 10.000 partite in un Web Worker
- ✅ Formato Commander (spunta sul mazzo): comandante in zona di comando, primo mulligan gratuito e
  pescata al turno 1, formula terre per 99 carte, controlli su 100 carte, singleton, identità di colore,
  carte bannate e partner
- ✅ Soglie delle fonti colorate calcolate con il modello completo di Karsten (strategia di mulligan
  inclusa): riproduce le sue tabelle 2022 per 40, 60 e 99 carte
- ✅ Condivisione via link: il mazzo è compresso nell'URL (nessun server); chi lo apre può provarlo,
  analizzarlo e salvarlo tra i suoi mazzi
- ✅ Salvataggio mazzi in LocalStorage
- ✅ Gestione multipli mazzi, editor con ricerca Scryfall, panoramica con curva di mana

## 📦 Installazione

```bash
npm install
```

## 🛠️ Sviluppo

```bash
npm run dev
```

Apri http://localhost:5173 nel browser.

```bash
npm test           # test (Vitest)
npm run typecheck  # TypeScript
npm run lint       # oxlint
```

## 📝 Formato Decklist

Il parser supporta i formati standard:

```
4 Lightning Bolt
4x Monastery Swiftspear
20 Mountain
1 Roiling Vortex
```

## 📋 Esempio Decklist di Test

Usa i file in `example-decks/` oppure questa decklist:

```
4 Lightning Bolt
4 Monastery Swiftspear
4 Eidolon of the Great Revel
4 Goblin Guide
4 Lava Spike
4 Rift Bolt
4 Skewer the Critics
2 Light Up the Stage
2 Searing Blood
2 Roiling Vortex
20 Mountain
4 Sunbaked Canyon
2 Den of the Bugbear
```

## 🏗️ Struttura Progetto

Stack: React 19 + TypeScript, Vite, Tailwind CSS v4, Motion (animazioni), React Router (hash router).

```
src/
├── analysis/              # Analisi mana base (funzioni pure + test)
│   ├── analyze.ts         # Orchestratore: DeckAnalysis
│   ├── cardProfile.ts     # Classificazione carte (terre, fetch, MDFC, fonti non-terra)
│   ├── manaBase.ts        # Fonti per colore e requisiti
│   ├── optimizer.ts       # Distribuzione ottimale delle terre base
│   ├── probability.ts     # Ipergeometrica e modello di Karsten
│   ├── simulate.ts        # Simulazione Monte Carlo (+ simulate.worker.ts)
│   └── warnings.ts        # Regole di warning
├── components/
│   ├── analysis/          # Pannelli della pagina Analisi
│   ├── cards/             # CardImage, CardModal, HandFan, CardSearch, DeckList
│   ├── charts/            # Curva di mana
│   ├── layout/            # AppShell, Logo
│   └── ui/                # Button, Panel, Modal, ConfirmDialog, ManaCost
├── formats.ts             # Regole dei formati (Constructed, Commander)
├── game/london.ts         # Mano iniziale e London mulligan (anche gratuito)
├── game/mulliganStrategy.ts # Strategia di mulligan di Karsten
├── hooks/                 # useDeckCards/useCards, useSimulation, useElementWidth
├── pages/                 # Lista mazzi, Import, Editor, Panoramica, Mano, Analisi
├── services/              # deckStorage (LocalStorage), scryfall (API + cache IndexedDB)
├── store/decks.ts         # Store dei mazzi (useSyncExternalStore)
├── utils/                 # Parser decklist, riepilogo mazzo, editing, shuffle
├── router.tsx             # Rotte
└── types.ts               # Modello dati
```

Rotte: `#/` mazzi · `#/import` · `#/new` · `#/deck/:id` (panoramica) · `#/deck/:id/hand` · `#/deck/:id/analysis` · `#/deck/:id/edit`.

La build (`npm run build`) usa percorsi relativi: la cartella `dist/` funziona anche servita da MAMP in una sottocartella.

## 🌍 Pubblicazione su Vercel

1. Su [vercel.com](https://vercel.com) → **Add New… → Project** → importa il repository `StefanoSinolli/mtghand`
2. Framework preset: **Vite** (build `npm run build`, output `dist`): i valori proposti vanno bene
3. **Deploy**. Da quel momento ogni push su `main` ripubblica l'app automaticamente

Il router usa gli hash (`#/deck/…`), quindi non serve nessuna configurazione di rewrite.
I link di condivisione usano l'indirizzo da cui è aperta l'app: condividili dalla versione pubblicata.

## 🔮 Prossimi Sviluppi

- [ ] Integrazione Firebase per profili utente
- [ ] Salvataggio mazzi nel cloud
- [ ] Statistiche mulligan
- [ ] Supporto Capacitor per app Android/iOS
- [ ] Test di goldfishing completo

## 📚 API

Il tool usa le [API di Scryfall](https://scryfall.com/docs/api) per ottenere le immagini e informazioni delle carte.

## 📱 Mobile App (Futuro)

Il progetto è configurato per essere facilmente convertito in app mobile con Capacitor:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
```

## 🙏 Credits

- Dati e immagini carte: [Scryfall](https://scryfall.com)
- Framework: [Vite](https://vitejs.dev) + [React](https://react.dev)
