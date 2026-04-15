/* ═══════════════════════════════════════════════════════
   HAULER  –  game.js
   Pixel-art memory grocery game
═══════════════════════════════════════════════════════ */

'use strict';

// ────────────────────────────────────────────────────────
//  CONSTANTS
// ────────────────────────────────────────────────────────
const ALL_ITEMS = [
  'Banana', 'Beef', 'Bread', 'Broccoli', 'Cabbage', 'Carrot',
  'Cheese', 'Chicken', 'Chili', 'Corn', 'Cucumber', 'Eggplant',
  'Eggs', 'Garlic', 'Milk', 'Onion', 'Potato', 'Red Bell Pepper',
  'Tomato', 'Tuna'
];

// Spoiled variants live in Items/Spoiled/ — same base names prefixed with "Spoiled "
// Note: no Cucumber spoiled variant exists, so we map to the items that do
const SPOILED_ITEMS = [
  'Banana', 'Beef', 'Bread', 'Broccoli', 'Cabbage', 'Carrot',
  'Cheese', 'Chicken', 'Chili', 'Corn', 'Cucumber', 'Eggplant',
  'Eggs', 'Garlic', 'Milk', 'Onion', 'Potato', 'Red Bell Pepper',
  'Tomato', 'Tuna'
];

const NOTE_DURATION = 5;          // seconds to memorise
const BASE_LIST_SIZE = 5;          // items on level 1
const PASS_THRESHOLD = 1;
const ITEM_DISPLAY_W = 70;         // px – canvas render size  (+10%)
const ITEM_DISPLAY_H = 70;
const SHELF_Y_FRAC = 0.49;         // vertical centre of empty shelf strip
const ITEMS_ON_SCREEN = 20;        // items circulating in the single lane
const BASE_SPEED = 1.8;            // px per frame at level 1
const SPEED_INCREMENT = 0.25;      // extra px per level
const ITEM_SPACING = Math.round((ITEM_DISPLAY_W + 20) * 1.7); // 1.7x interval ≈ 153px

// Ratio of spoiled items in the random stream
const SPOIL_RATIO = 0.25;

// How many decoy (wrong) items mixed in beside list items
const DECOY_RATIO = 0.45;

// ────────────────────────────────────────────────────────
//  STATE
// ────────────────────────────────────────────────────────
let level = 1;
let listSize = BASE_LIST_SIZE;
let groceryList = [];   // [{name, qty}]
let basket = [];   // names collected (may duplicate for qty)
const bgMusic = document.getElementById('bg-music');

function playClickSFX() {
  const sfxClick = document.getElementById('sfx-click');
  if (!sfxClick) return;
  sfxClick.currentTime = 0;
  sfxClick.volume = 0.3;  // ← 0.0 (silent) to 1.0 (full)
  sfxClick.play().catch(() => { });
}

// ────────────────────────────────────────────────────────
//  IMAGE PRELOAD CACHE
// ────────────────────────────────────────────────────────
const imgCache = {};   // name -> HTMLImageElement  (normal items)
const spoiledCache = {};   // name -> HTMLImageElement  (Items/Spoiled/Spoiled <name>.png)

function preloadImages() {
  return new Promise(resolve => {
    const all = ALL_ITEMS.length + SPOILED_ITEMS.length;
    let loaded = 0;
    const tick = () => { if (++loaded === all) resolve(); };

    // Normal items
    ALL_ITEMS.forEach(name => {
      const img = new Image();
      img.src = `Items/${name}.png`;
      img.onload = img.onerror = () => { imgCache[name] = img; tick(); };
    });

    // Spoiled items from Items/Spoiled/
    SPOILED_ITEMS.forEach(name => {
      const img = new Image();
      img.src = `Items/Spoiled/Spoiled ${name}.png`;
      img.onload = img.onerror = () => { spoiledCache[name] = img; tick(); };
    });
  });
}

// ────────────────────────────────────────────────────────
//  SCREEN MANAGER
// ────────────────────────────────────────────────────────
const screens = {
  menu: document.getElementById('screen-menu'),
  note: document.getElementById('screen-note'),
  store: document.getElementById('screen-store'),
  results: document.getElementById('screen-results'),
};

function showScreen(id) {
  Object.values(screens).forEach(s => {
    s.classList.remove('active', 'screen-fade-enter');
  });
  const el = screens[id];
  el.classList.add('active', 'screen-fade-enter');
}

// ────────────────────────────────────────────────────────
//  MENU
// ────────────────────────────────────────────────────────

document.getElementById('btn-start').addEventListener('click', startGame);

function startGame() {
  level = 1;
  listSize = BASE_LIST_SIZE;
  // Start the music here!
  bgMusic.currentTime = 0; // Restart track from beginning
  bgMusic.volume = 0.2; // Set volume to 50%
  bgMusic.play().catch(e => console.error("Audio failed:", e));    // Optional: Set a comfortable volume
  beginRound();

}

// ────────────────────────────────────────────────────────
//  BUILD GROCERY LIST
// ────────────────────────────────────────────────────────
function buildGroceryList(size) {
  // Pick random unique items
  const pool = [...ALL_ITEMS].sort(() => Math.random() - 0.5);
  const picked = [];
  let remaining = size;

  // We might assign 2x or 3x to some items as long as total = size
  while (remaining > 0 && pool.length > 0) {
    const name = pool.shift();
    // How many can this item take?
    let maxQty = Math.min(3, remaining);
    // If it's the last slot only allow 1
    if (pool.length === 0) maxQty = remaining;
    const qty = (maxQty > 1 && Math.random() < 0.35)
      ? (maxQty === 3 && Math.random() < 0.4 ? 3 : 2)
      : 1;
    const realQty = Math.min(qty, remaining);
    picked.push({ name, qty: realQty });
    remaining -= realQty;
    if (remaining === 0) break;
  }
  return picked;
}

// ────────────────────────────────────────────────────────
//  NOTE SCREEN
// ────────────────────────────────────────────────────────
let noteTimerInterval = null;

function beginRound() {
  basket = [];
  groceryList = buildGroceryList(listSize);

  // Render note
  const ul = document.getElementById('note-list');
  ul.innerHTML = '';
  groceryList.forEach(({ name, qty }) => {
    const li = document.createElement('li');
    const img = new Image();
    img.src = `Items/${name}.png`;
    img.alt = name;
    img.style.imageRendering = 'pixelated';

    const label = document.createElement('span');
    label.textContent = name;

    const qtySpan = document.createElement('span');
    qtySpan.className = 'item-qty';
    if (qty > 1) qtySpan.textContent = `×${qty}`;

    li.appendChild(img);
    li.appendChild(label);
    li.appendChild(qtySpan);
    ul.appendChild(li);
  });

  // Update HUD totals
  const totalItems = groceryList.reduce((s, i) => s + i.qty, 0);
  document.getElementById('hud-total').textContent = totalItems;
  document.getElementById('hud-collected').textContent = 0;
  document.getElementById('hud-level').textContent = level;

  showScreen('note');
  startNoteTimer();
}

function startNoteTimer() {
  const fill = document.getElementById('note-timer-fill');
  const countdown = document.getElementById('note-countdown');
  let elapsed = 0;
  const step = 100; // ms

  fill.style.width = '100%';
  countdown.textContent = NOTE_DURATION;

  clearInterval(noteTimerInterval);
  noteTimerInterval = setInterval(() => {
    elapsed += step;
    const pct = Math.max(0, 1 - elapsed / (NOTE_DURATION * 1000));
    fill.style.width = `${pct * 100}%`;
    countdown.textContent = Math.ceil((NOTE_DURATION * 1000 - elapsed) / 1000);

    if (elapsed >= NOTE_DURATION * 1000) {
      clearInterval(noteTimerInterval);
      beginStore();
    }
  }, step);
}

// ────────────────────────────────────────────────────────
//  STORE SCREEN  –  Canvas Scroller
// ────────────────────────────────────────────────────────
const canvas = document.getElementById('store-canvas');
const ctx2d = canvas.getContext('2d');

let storeRunning = false;
let animFrameId = null;
let storeItems = [];   // scrolling item objects

/** One scrolling item on the shelf – single lane, right-to-left */
class ShelfItem {
  constructor(name, x, spoiled) {
    this.name = name;
    this.x = x;       // left edge in canvas px
    this.spoiled = spoiled; // true → render from spoiledCache, counts as basket waste

    this.yFrac = SHELF_Y_FRAC;
    this.y = 0;       // set in resizeCanvas / buildStoreItems
    this.w = ITEM_DISPLAY_W;
    this.h = ITEM_DISPLAY_H;
    this.speed = BASE_SPEED + (level - 1) * SPEED_INCREMENT;
    this.clicked = false;
    this.popAnim = 0;
  }

  update() {
    if (this.clicked) {
      this.popAnim++;
      return;
    }
    // Scroll RIGHT → LEFT
    this.x -= this.speed;
  }

  draw(ctx) {
    if (this.clicked && this.popAnim > 8) return; // fully collected

    // Use spoiledCache for spoiled items, imgCache for normal ones
    const img = this.spoiled ? spoiledCache[this.name] : imgCache[this.name];
    if (!img) return;

    ctx.save();

    // Pop animation: scale up then fade out
    if (this.clicked) {
      const t = this.popAnim / 8;
      ctx.globalAlpha = 1 - t;
      const s = 1 + t * 0.6;
      ctx.translate(this.x + this.w / 2, this.y);
      ctx.scale(s, s);
      ctx.translate(-(this.x + this.w / 2), -this.y);
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, this.x, this.y - this.h, this.w, this.h);

    ctx.restore();
  }

  get rect() {
    return {
      left: this.x,
      right: this.x + this.w,
      top: this.y - this.h,
      bottom: this.y,
    };
  }
}

// ── Resize canvas to match viewport ──────────────────────
function resizeCanvas() {
  // Always use window dimensions for a reliable 16:9-friendly canvas size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  storeItems.forEach(item => {
    item.y = SHELF_Y_FRAC * canvas.height;
  });
}
window.addEventListener('resize', resizeCanvas);

// ── Build initial pool of scrolling items ────────────────
function buildStoreItems() {
  storeItems = [];

  // Flatten grocery list into individual item slots
  const listNames = [];
  groceryList.forEach(({ name, qty }) => {
    for (let i = 0; i < qty; i++) listNames.push(name);
  });

  // Decoy pool: normal items NOT on the list
  const decoyPool = ALL_ITEMS.filter(n => !groceryList.find(g => g.name === n));
  const decoyCount = Math.ceil(listNames.length * (DECOY_RATIO / (1 - DECOY_RATIO)));

  const allNames = [...listNames];
  for (let i = 0; i < decoyCount; i++) {
    allNames.push(decoyPool[Math.floor(Math.random() * decoyPool.length)]);
  }

  // Shuffle thoroughly
  for (let pass = 0; pass < 4; pass++) allNames.sort(() => Math.random() - 0.5);

  // Sprinkle spoiled items into the pool
  const spoiledCount = Math.max(2, Math.round(allNames.length * SPOIL_RATIO));
  for (let i = 0; i < spoiledCount; i++) {
    allNames.splice(
      Math.floor(Math.random() * allNames.length),
      0,
      '__SPOILED__'   // placeholder; replaced in ShelfItem constructor below
    );
  }

  // Items start spread off the RIGHT edge and scroll leftward.
  const shelfY = SHELF_Y_FRAC * canvas.height;

  allNames.forEach((name, idx) => {
    const x = canvas.width + 40 + idx * ITEM_SPACING;
    const isSpoil = name === '__SPOILED__';
    const realName = isSpoil
      ? SPOILED_ITEMS[Math.floor(Math.random() * SPOILED_ITEMS.length)]
      : name;
    const item = new ShelfItem(realName, x, isSpoil);
    item.y = shelfY;
    storeItems.push(item);
  });
}

// ── Main game loop ────────────────────────────────────────
function gameLoop() {
  if (!storeRunning) return;

  ctx2d.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the dark shelf area (the #222D2D strip that items scroll on)
  // This is drawn on top of Shelf.png by the CSS background, the canvas is transparent.

  // Update + draw items
  storeItems.forEach(item => item.update());
  storeItems.forEach(item => item.draw(ctx2d));

  // Respawn items that scroll off the LEFT edge back to the RIGHT
  storeItems.forEach(item => {
    if (!item.clicked && item.x + item.w < -10) {
      respawnItem(item);
    }
  });

  // Recycle clicked items once their pop animation is done —
  // this keeps the pool size constant so scrolling NEVER runs dry
  storeItems.forEach(item => {
    if (item.clicked && item.popAnim > 8) {
      item.clicked = false;
      item.popAnim = 0;
      respawnItem(item);
    }
  });

  animFrameId = requestAnimationFrame(gameLoop);
}

/** Reset an item and queue it off the right edge with a fresh random identity */
function respawnItem(item) {
  // Only look at items already fully off the right edge (the waiting queue)
  const queued = storeItems.filter(i => i !== item && i.x > canvas.width);
  const maxX = queued.length > 0
    ? Math.max(...queued.map(i => i.x))
    : canvas.width;

  item.x = maxX + ITEM_SPACING;
  item.y = SHELF_Y_FRAC * canvas.height;
  item.clicked = false;
  item.popAnim = 0;

  // Decide normal vs spoiled
  item.spoiled = Math.random() < SPOIL_RATIO;
  if (item.spoiled) {
    item.name = SPOILED_ITEMS[Math.floor(Math.random() * SPOILED_ITEMS.length)];
  } else {
    item.name = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
  }
}

// ── Click / tap handling ──────────────────────────────────
function onStoreClick(e) {
  if (!storeRunning) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (e.clientX - rect.left) * scaleX;
  const cy = (e.clientY - rect.top) * scaleY;

  // Find topmost un-clicked item under cursor
  for (let i = storeItems.length - 1; i >= 0; i--) {
    const item = storeItems[i];
    if (item.clicked) continue;
    const r = item.rect;
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
      handleItemClick(item, cx, cy, e.clientX, e.clientY);
      break;
    }
  }
}

// Attach click on the store screen (covers shelf + canvas)
document.getElementById('screen-store').addEventListener('click', onStoreClick);

function handleItemClick(item, _cx, _cy, clientX, clientY) {
  // ALL taps consume a basket slot (spoiled, wrong, or correct).
  // Spoiled items are identified by their spoiled flag — they look different
  // from normal items but are never on the grocery note.
  const inList = !item.spoiled && !!groceryList.find(g => g.name === item.name);

  basket.push(item.spoiled ? `__SPOILED__${item.name}` : item.name);
  item.clicked = true;
  showClickFeedback(clientX, clientY, inList ? '#56d461' : '#e63946');
  updateBasketHUD();
  console.log('item clicked:', item.name);  // ← add this
  playClickSFX();

  // Check basket limit
  const basketLimit = groceryList.reduce((s, i) => s + i.qty, 0);
  if (basket.length >= basketLimit) {
    storeRunning = false;
    cancelAnimationFrame(animFrameId);
    showBasketLimitPopup();
  }
}

function updateBasketHUD() {
  document.getElementById('hud-collected').textContent = basket.length;

  const preview = document.getElementById('basket-items-preview');
  if (basket.length > 0) {
    const name = basket[basket.length - 1];
    const isSpoiled = name.startsWith('__SPOILED__');
    const realName = isSpoiled ? name.replace('__SPOILED__', '') : name;
    const img = new Image();
    img.src = isSpoiled ? `Items/Spoiled/Spoiled ${realName}.png` : `Items/${realName}.png`;
    img.alt = realName;
    img.title = isSpoiled ? `Spoiled ${realName}` : realName;
    img.style.imageRendering = 'pixelated';
    preview.appendChild(img);
  }
}

/** Pixel-art popup shown when the basket hits its limit, then auto-leaves */
function showBasketLimitPopup() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 200;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.72);
    font-family: 'Press Start 2P', monospace;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background: #0f1f0f;
    border: 4px solid #000;
    box-shadow: 6px 6px 0 #000;
    padding: 32px 44px;
    display: flex; flex-direction: column;
    align-items: center; gap: 14px;
    text-align: center;
    animation: note-drop 0.35s cubic-bezier(0.22,1,0.36,1) both;
  `;

  const icon = document.createElement('div');
  icon.style.fontSize = '52px';
  icon.textContent = '🛒';

  const title = document.createElement('p');
  title.style.cssText = 'font-size: 13px; color: #f5c518; line-height: 2; text-shadow: 3px 3px 0 #000;';
  title.textContent = 'Basket Full!';

  const sub = document.createElement('p');
  sub.style.cssText = 'font-size: 8px; color: #a0c8a0; line-height: 2;';
  sub.textContent = 'Leaving store...';

  // Countdown dots
  const dots = document.createElement('p');
  dots.style.cssText = 'font-size: 10px; color: #56d461; letter-spacing: 6px;';
  dots.textContent = '• • •';

  box.appendChild(icon);
  box.appendChild(title);
  box.appendChild(sub);
  box.appendChild(dots);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.remove();
    showResults();
  }, 2000);
}

function showClickFeedback(x, y, color) {
  const div = document.createElement('div');
  div.className = 'click-ripple';
  div.style.left = x + 'px';
  div.style.top = y + 'px';
  div.style.borderColor = color;
  document.body.appendChild(div);
  div.addEventListener('animationend', () => div.remove());
}

// ── Begin store phase ─────────────────────────────────────
function beginStore() {
  document.getElementById('basket-items-preview').innerHTML = '';
  showScreen('store');

  // Give the screen a frame to render before we set canvas size
  requestAnimationFrame(() => {
    resizeCanvas();
    buildStoreItems();
    storeRunning = true;
    gameLoop();
  });
}

// ── Leave button ──────────────────────────────────────────
document.getElementById('btn-leave').addEventListener('click', () => {
  if (!storeRunning) return;
  storeRunning = false;
  cancelAnimationFrame(animFrameId);
  showResults();
});

// ────────────────────────────────────────────────────────
//  RESULTS SCREEN
// ────────────────────────────────────────────────────────
function showResults() {
  // Build expected flat list
  const expected = [];
  groceryList.forEach(({ name, qty }) => {
    for (let i = 0; i < qty; i++) expected.push(name);
  });

  // Separate spoiled picks out — they are always wrong by definition
  const spoiledPicks = basket.filter(n => n.startsWith('__SPOILED__'));
  const normalPicks = basket.filter(n => !n.startsWith('__SPOILED__'));

  const expectedCopy = [...expected];
  const correctPicks = [];
  const wrongPicks = [...spoiledPicks]; // spoiled always count as wrong

  normalPicks.forEach(name => {
    const idx = expectedCopy.indexOf(name);
    if (idx !== -1) {
      correctPicks.push(name);
      expectedCopy.splice(idx, 1);
    } else {
      wrongPicks.push(name);
    }
  });

  const missed = expectedCopy; // list items not collected

  // Accuracy = correct / total expected
  const totalExpected = expected.length;
  const accuracy = totalExpected > 0 ? correctPicks.length / totalExpected : 0;

  // Stars: <70% = 1★, 70-89% = 2★, ≥90% = 3★
  const stars = accuracy >= 1.00 ? 3 : accuracy >= 0.80 ? 2 : 1;

  const starsRow = document.getElementById('results-stars');
  starsRow.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    const span = document.createElement('span');
    span.className = 'star';
    span.textContent = '⭐';
    starsRow.appendChild(span);
    if (i <= stars) setTimeout(() => span.classList.add('lit'), i * 220);
  }

  document.getElementById('results-percent').textContent =
    `Accuracy: ${Math.round(accuracy * 100)}%`;

  // Spoiled warning banner
  const spoiledWarning = document.getElementById('results-spoiled-warning');
  if (spoiledPicks.length > 0) {
    spoiledWarning.textContent =
      `⚠ You picked up ${spoiledPicks.length} spoiled item${spoiledPicks.length > 1 ? 's' : ''}!`;
    spoiledWarning.style.display = '';
  } else {
    spoiledWarning.style.display = 'none';
  }

  renderCmpColumn('cmp-list', groceryList, correctPicks, missed, true);
  renderCmpColumn('cmp-grabbed', buildGrabbedList(correctPicks, wrongPicks), correctPicks, wrongPicks, false);

  const failMsg = document.getElementById('results-fail-msg');
  const nextBtn = document.getElementById('btn-next');
  if (accuracy >= PASS_THRESHOLD) {
    failMsg.style.display = 'none';
    nextBtn.style.display = '';
  } else {
    failMsg.style.display = '';
    nextBtn.style.display = 'none';
  }

  showScreen('results');
}

/** Turn correctPicks + wrongPicks into [{name, qty}] for display */
function buildGrabbedList(correct, wrong) {
  const map = {};
  [...correct, ...wrong].forEach(n => {
    map[n] = (map[n] || 0) + 1;
  });
  return Object.entries(map).map(([name, qty]) => ({ name, qty }));
}

function renderCmpColumn(colId, items, correctPicks, negatives, isListSide) {
  const container = document.getElementById(colId);
  container.innerHTML = '';

  if (isListSide) {
    const remainingCorrect = [...correctPicks];
    items.forEach(({ name, qty }) => {
      // Count how many units of this item the player actually got
      let gotCount = 0;
      for (let i = 0; i < qty; i++) {
        const idx = remainingCorrect.indexOf(name);
        if (idx !== -1) { gotCount++; remainingCorrect.splice(idx, 1); }
      }

      const div = document.createElement('div');
      const allGot = gotCount === qty;
      const noneGot = gotCount === 0;
      div.className = 'cmp-item ' + (allGot ? 'correct' : 'missed');

      const img = new Image();
      img.src = `Items/${name}.png`;
      img.style.imageRendering = 'pixelated';

      const label = document.createElement('span');
      let text = name;
      if (qty > 1) text += ` ×${qty}`;
      if (allGot) text += ' ✓';
      else if (!noneGot) text += ` (${gotCount}/${qty}) ✓`;
      else text += ' ✗';
      label.textContent = text;

      div.appendChild(img); div.appendChild(label);
      container.appendChild(div);
    });
  } else {
    items.forEach(({ name, qty }) => {
      const isSpoiled = name.startsWith('__SPOILED__');
      const realName = isSpoiled ? name.replace('__SPOILED__', '') : name;
      console.log('name:', name, '| isSpoiled:', isSpoiled, '| realName:', realName); // ← add this
      const isInList = !isSpoiled && !!groceryList.find(g => g.name === realName);

      const div = document.createElement('div');
      // Spoiled gets its own purple-tinted class, wrong items get red, correct get green
      div.className = 'cmp-item ' + (isSpoiled ? 'spoiled' : isInList ? 'correct' : 'wrong');

      const img = new Image();
      img.src = isSpoiled
        ? `Items/Spoiled/Spoiled ${realName}.png`
        : `Items/${realName}.png`;
      img.style.imageRendering = 'pixelated';

      const label = document.createElement('span');
      // Explicitly label spoiled items — makes it unambiguous in the results
      const displayName = isSpoiled ? `Spoiled ${realName}` : realName;
      const suffix = isInList ? ' ✓' : isSpoiled ? '' : ' ✗';
      label.textContent = displayName + (qty > 1 ? ` ×${qty}` : '') + suffix;

      div.appendChild(img); div.appendChild(label);
      container.appendChild(div);
    });
  }
}

// ── Results buttons ───────────────────────────────────────
document.getElementById('btn-exit').addEventListener('click', () => {
  showScreen('menu');
});

document.getElementById('btn-next').addEventListener('click', () => {
  level++;
  listSize++;
  beginRound();
});

// ────────────────────────────────────────────────────────
//  BOOT
// ────────────────────────────────────────────────────────
(async () => {
  // Preload all item images before showing the menu
  await preloadImages();
  showScreen('menu');
})();
