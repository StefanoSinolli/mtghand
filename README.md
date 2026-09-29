# 🎴 MTG Hand Simulator

Tool web per simulare la mano iniziale di Magic: The Gathering, con supporto per mulligan London style.

## 🚀 Funzionalità

- ✅ Importa mazzi da file .txt/.dek o copia/incolla (formati testo, Arena, MTGO)
- ✅ Visualizzazione delle carte con immagini da Scryfall
- ✅ Pesca mano iniziale di 7 carte
- ✅ Mulligan London: Mulligan/Keep, poi scelta delle carte da mettere in fondo
- ✅ Analisi della mana base su richiesta:
  - fonti per colore rispetto alle soglie di Frank Karsten (fetch, dual, MDFC, Signet e dork inclusi)
  - warning su terre fuori colore, colori sotto soglia, terre tappate o incolori
  - numero di terre consigliato (formula di Karsten) e probabilità della mano iniziale
  - distribuzione ottimale delle terre base, applicabile al mazzo con un clic
  - simulazione Monte Carlo di 10.000 partite in un Web Worker
- ✅ Salvataggio mazzi in LocalStorage
- ✅ Gestione multipli mazzi

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

```
src/
├── components/            # Componenti React
│   ├── Card.tsx           # Singola carta MTG
│   ├── Analysis.tsx       # Pannello di analisi della mana base
│   ├── CardDetails.tsx    # Modale con i dettagli della carta
│   ├── DeckImport.tsx     # Importazione / creazione mazzi
│   └── Hand.tsx           # Simulatore mano iniziale
├── analysis/              # Analisi mana base (funzioni pure + test)
│   ├── analyze.ts         # Orchestratore: DeckAnalysis
│   ├── cardProfile.ts     # Classificazione carte (terre, fetch, MDFC, fonti non-terra)
│   ├── manaBase.ts        # Fonti per colore e requisiti
│   ├── manaCost.ts        # Parser dei costi di mana
│   ├── optimizer.ts       # Distribuzione ottimale delle terre base
│   ├── probability.ts     # Ipergeometrica e modello di Karsten
│   ├── simulate.ts        # Simulazione Monte Carlo (+ simulate.worker.ts)
│   └── warnings.ts        # Regole di warning
├── game/
│   └── london.ts          # Logica mano iniziale e London mulligan
├── hooks/
│   ├── useDeckCards.ts    # Dati Scryfall di tutto il mazzo
│   └── useSimulation.ts   # Simulazione nel Web Worker
├── services/
│   ├── deckStorage.ts     # LocalStorage + migrazione formati vecchi
│   └── scryfall.ts        # API Scryfall con cache IndexedDB
├── utils/
│   ├── deckParser.ts      # Parser decklist
│   └── shuffle.ts         # Fisher-Yates
├── types.ts               # Modello dati (Deck, DeckEntry, ScryfallCard…)
└── App.tsx                # App principale
```

## 🔮 Prossimi Sviluppi

- [ ] Integrazione Firebase per profili utente
- [ ] Salvataggio mazzi nel cloud
- [ ] Statistiche mulligan
- [ ] Supporto Capacitor per app Android/iOS
- [ ] Visualizzazione curva mana
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
