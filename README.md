# 🛒 Hauler — Memory Grocery Run

A fast-paced memory game with a 16-bit pixel art aesthetic. Memorize your shopping list, head into the store, and grab the right items before your basket fills up — but watch out for spoiled goods and decoys!

## 🎮 How to Play

1. **Memorize** — A shopping list appears on screen. You have 5 seconds to remember it.
2. **Shop** — Items scroll across the store shelf. Click the ones on your list.
3. **Checkout** — See how accurately you shopped. Get 100% to advance to the next level!

## ⚠️ Watch Out For

- **Decoy items** — Items that look tempting but aren't on your list
- **Spoiled items** — Visually distinct rotten versions of groceries that waste a basket slot
- **Limited basket** — You only get as many picks as items on your list, so every click counts

## 🌟 Scoring

| Stars | Accuracy |
|-------|----------|
| ⭐⭐⭐ | 100% |
| ⭐⭐ | 80–99% |
| ⭐ | Below 80% |

You need **100% accuracy** to advance to the next level.

## 📈 Progression

- Each level adds one more item to your shopping list
- Items scroll faster as levels increase
- List items may have quantities (×2, ×3) to track

## 🛠️ Built With

- Vanilla JavaScript (no frameworks)
- HTML5 Canvas for the scrolling shelf
- CSS animations
- Press Start 2P font (Google Fonts)
- 16-bit pixel art assets

## 📁 Project Structure

```
Hauler/
├── index.html
├── game.js
├── style.css
├── Note.png
├── Shelf.png
├── Basket.png
├── assets/
│   ├── music.mp3
│   └── collect.mp3
└── Items/
    ├── Banana.png
    ├── Beef.png
    ├── ...
    └── Spoiled/
        ├── Spoiled Banana.png
        ├── Spoiled Beef.png
        └── ...
```

## 🚀 Play Online

[Play Hauler on Vercel](hauler-hazel.vercel.app) <!-- Replace # with your Vercel URL -->

## 🖥️ Run Locally

Just open `index.html` in your browser — no build tools or installs required.
