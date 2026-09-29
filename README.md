# 🎴 MTG Hand Simulator

Tool web per simulare la mano iniziale di Magic: The Gathering, con supporto per mulligan London style.

## 🚀 Funzionalità

- ✅ Importa mazzi da file .txt o copia/incolla
- ✅ Visualizzazione delle carte con immagini da Scryfall
- ✅ Pesca mano iniziale di 7 carte
- ✅ Mulligan (London Mulligan rule)
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

## 📝 Formato Decklist

Il parser supporta i formati standard:

```
4 Lightning Bolt
4x Monastery Swiftspear
20 Mountain
1 Roiling Vortex
```

## 📋 Esempio Decklist di Test

Usa il file `example-deck.txt` oppure questa decklist:

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
├── components/         # Componenti React
│   ├── Card.jsx       # Singola carta MTG
│   ├── DeckImport.jsx # Importazione mazzi
│   └── Hand.jsx       # Visualizzazione mano
├── services/          # Servizi
│   ├── deckStorage.js # LocalStorage (futuro: Firebase)
│   └── scryfall.js    # API Scryfall
├── utils/            # Utility
│   ├── deckParser.js # Parser decklist
│   └── shuffle.js    # Shuffle e mulligan logic
└── App.jsx           # App principale
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
