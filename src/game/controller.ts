import { Tile } from "./engine"
import {
  Grid,
  type Direction,
  TARGET,
  movesAvailable,
  move,
  spawnRandomTile,
} from "./engine"

const SIZE = 4
const BEST_KEY = "aurora2048:best"

const TIER_GLOW: Record<number, string> = {
  2: "hsla(178,70%,55%,0.6)",
  4: "hsla(198,75%,58%,0.62)",
  8: "hsla(212,90%,65%,0.68)",
  16: "hsla(236,85%,72%,0.7)",
  32: "hsla(258,85%,70%,0.72)",
  64: "hsla(285,85%,68%,0.74)",
  128: "hsla(315,90%,66%,0.78)",
  256: "hsla(340,90%,64%,0.8)",
  512: "hsla(28,95%,58%,0.82)",
  1024: "hsla(46,95%,60%,0.88)",
  2048: "hsla(52,100%,70%,0.95)",
}

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
  k: "up",
  j: "down",
  h: "left",
  l: "right",
}

export class Game {
  private readonly size = SIZE
  private grid = new Grid(SIZE)
  private score = 0
  private best = 0
  private history: Snapshot[] = []
  private won = false
  private over = false

  private cell = 0
  private gap = 0

  private readonly root: HTMLElement
  private readonly board: HTMLElement
  private readonly cellsEl: HTMLElement
  private readonly tilesEl: HTMLElement
  private readonly scoreEl: HTMLElement
  private readonly bestEl: HTMLElement
  private readonly scoreBox: HTMLElement
  private readonly boardFrame: HTMLElement
  private readonly overlayWin: HTMLElement
  private readonly overlayOver: HTMLElement
  private readonly undoBtn: HTMLButtonElement

  constructor(root: HTMLElement) {
    this.root = root
    this.root.innerHTML = SHELL

    this.board = require(this.root, "#board")
    this.cellsEl = require(this.root, "#cells")
    this.tilesEl = require(this.root, "#tiles")
    this.scoreEl = require(this.root, "#score")
    this.bestEl = require(this.root, "#best")
    this.scoreBox = require(this.root, "#scoreBox")
    this.boardFrame = require(this.root, "#board-frame")
    this.overlayWin = require(this.root, "#overlayWin")
    this.overlayOver = require(this.root, "#overlayOver")
    this.undoBtn = require(this.root, "#undo")

    this.best = loadBest()
    this.bestEl.textContent = String(this.best)

    this.buildCells()
    this.bindEvents()
    this.layout()
    new ResizeObserver(() => this.layout()).observe(this.board)

    this.start()
  }

  start(): void {
    this.grid = new Grid(this.size)
    this.score = 0
    this.history = []
    this.won = false
    this.over = false
    spawnRandomTile(this.grid)
    spawnRandomTile(this.grid)
    this.hideOverlay(this.overlayWin)
    this.hideOverlay(this.overlayOver)
    this.scoreEl.textContent = "0"
    this.render()
    this.updateAura()
    this.refreshUndo()
  }

  handleMove(dir: Direction): void {
    if (this.over) return
    if (this.overlayWin.classList.contains("show")) return

    const before = { grid: this.grid.clone(), score: this.score }
    const result = move(this.grid, dir)
    if (!result.moved) return

    this.history.push(before)
    if (this.history.length > 25) this.history.shift()
    this.score += result.score
    spawnRandomTile(this.grid)

    this.render()
    this.emitMergeParticles()
    this.updateScore(result.score)
    this.updateAura()
    this.refreshUndo()

    if (result.won && !this.won) {
      this.won = true
      this.showOverlay(this.overlayWin)
    } else if (!movesAvailable(this.grid)) {
      this.over = true
      this.showOverlay(this.overlayOver)
    }
  }

  undo(): void {
    const snap = this.history.pop()
    if (!snap) return
    this.grid = snap.grid
    this.score = snap.score
    this.over = false
    this.hideOverlay(this.overlayOver)
    this.render()
    this.updateScore(0)
    this.updateAura()
    this.refreshUndo()
  }

  private render(): void {
    this.tilesEl.replaceChildren()

    for (const tile of this.grid.tiles()) {
      this.addTile(tile)
    }

    this.markHighest()
  }

  private addTile(tile: Tile): void {
    const wrapper = document.createElement("div")
    wrapper.className = "tile"
    wrapper.dataset.row = String(tile.row)
    wrapper.dataset.col = String(tile.col)

    const inner = document.createElement("div")
    inner.className = "tile-inner"
    inner.dataset.v = String(tile.value)
    inner.dataset.len = String(String(tile.value).length)
    inner.textContent = String(tile.value)
    if (tile.value > TARGET) inner.classList.add("super")
    wrapper.appendChild(inner)

    const start = tile.previousPosition ?? { row: tile.row, col: tile.col }
    this.place(wrapper, start.row, start.col)

    if (tile.mergedFrom) {
      wrapper.classList.add("is-merged")
      for (const source of tile.mergedFrom) this.addTile(source)
    } else if (!tile.previousPosition) {
      wrapper.classList.add("is-new")
    }

    this.tilesEl.appendChild(wrapper)

    if (tile.previousPosition) {
      void wrapper.offsetWidth
      this.place(wrapper, tile.row, tile.col)
    }
  }

  private place(el: HTMLElement, row: number, col: number): void {
    el.style.setProperty("--x", `${col * (this.cell + this.gap)}px`)
    el.style.setProperty("--y", `${row * (this.cell + this.gap)}px`)
    el.dataset.row = String(row)
    el.dataset.col = String(col)
  }

  private layout(): void {
    const firstCell = this.cellsEl.firstElementChild as HTMLElement | null
    if (!firstCell) return
    this.cell = firstCell.getBoundingClientRect().width
    this.gap = parseFloat(getComputedStyle(this.cellsEl).columnGap) || 0
    this.tilesEl.style.setProperty("--cell", `${this.cell}px`)
    for (const child of Array.from(this.tilesEl.children)) {
      const el = child as HTMLElement
      const row = Number(el.dataset.row)
      const col = Number(el.dataset.col)
      el.style.setProperty("--x", `${col * (this.cell + this.gap)}px`)
      el.style.setProperty("--y", `${row * (this.cell + this.gap)}px`)
    }
  }

  private markHighest(): void {
    const tiles = this.grid.tiles()
    if (tiles.length === 0) return
    let max = tiles[0]
    for (const t of tiles) if (t.value > max.value) max = t
    for (const child of Array.from(this.tilesEl.children)) {
      const el = child as HTMLElement
      const isMax =
        Number(el.dataset.row) === max.row && Number(el.dataset.col) === max.col
      el.classList.toggle("highest", isMax)
    }
  }

  private updateScore(gained: number): void {
    this.scoreEl.textContent = String(this.score)
    if (this.score > this.best) {
      this.best = this.score
      this.bestEl.textContent = String(this.best)
      saveBest(this.best)
    }
    if (gained > 0) {
      this.bump(this.scoreBox)
      this.popScore(gained)
    }
  }

  private popScore(amount: number): void {
    const pop = document.createElement("span")
    pop.className = "score-popup"
    pop.textContent = `+${amount}`
    this.scoreBox.appendChild(pop)
    setTimeout(() => pop.remove(), 900)
  }

  private bump(el: HTMLElement): void {
    el.classList.remove("bump")
    void el.offsetWidth
    el.classList.add("bump")
  }

  private updateAura(): void {
    const tiles = this.grid.tiles()
    let max = 0
    for (const t of tiles) if (t.value > max) max = t.value
    const glow =
      max >= TARGET
        ? "hsla(52,100%,70%,0.5)"
        : (TIER_GLOW[max] ?? "hsla(200,80%,50%,0.25)")
    this.boardFrame.style.setProperty("--aura", glow)
  }

  private emitMergeParticles(): void {
    for (const tile of this.grid.tiles()) {
      if (!tile.mergedFrom) continue
      this.burst(tile.row, tile.col, tile.value)
    }
  }

  private burst(row: number, col: number, value: number): void {
    const cx = this.gap + col * (this.cell + this.gap) + this.cell / 2
    const cy = this.gap + row * (this.cell + this.gap) + this.cell / 2
    const color =
      value >= TARGET
        ? "#fff06a"
        : (TIER_GLOW[value] ?? "#9be7ff").replace(/[\d.]+\)$/, "1)")
    const count = value >= 256 ? 12 : 8
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div")
      p.className = "particle"
      p.style.left = `${cx}px`
      p.style.top = `${cy}px`
      p.style.background = color
      p.style.boxShadow = `0 0 8px ${color}`
      this.board.appendChild(p)
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6
      const dist = this.cell * (0.5 + Math.random() * 0.55)
      const dx = Math.cos(angle) * dist
      const dy = Math.sin(angle) * dist
      p.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 0.95 },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2)`,
            opacity: 0,
          },
        ],
        {
          duration: 520 + Math.random() * 260,
          easing: "cubic-bezier(0.2,0.7,0.3,1)",
        },
      ).onfinish = () => p.remove()
    }
  }

  private showOverlay(el: HTMLElement): void {
    el.classList.add("show")
  }

  private hideOverlay(el: HTMLElement): void {
    el.classList.remove("show")
  }

  private buildCells(): void {
    const frag = document.createDocumentFragment()
    for (let i = 0; i < this.size * this.size; i++) {
      const cell = document.createElement("div")
      cell.className = "cell"
      frag.appendChild(cell)
    }
    this.cellsEl.appendChild(frag)
  }

  private refreshUndo(): void {
    this.undoBtn.disabled = this.history.length === 0
  }

  private bindEvents(): void {
    window.addEventListener("keydown", (e) => {
      const dir = KEY_MAP[e.key]
      if (!dir) return
      e.preventDefault()
      this.handleMove(dir)
    })

    const dpad = this.root.querySelector<HTMLElement>(".dpad")
    dpad?.addEventListener("click", (e) => {
      const target = e.target as HTMLElement
      const dir = target.closest<HTMLElement>("[data-dir]")?.dataset.dir as
        | Direction
        | undefined
      if (dir) this.handleMove(dir)
    })

    let sx = 0
    let sy = 0
    let tracking = false
    this.board.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0]
        sx = t.clientX
        sy = t.clientY
        tracking = true
      },
      { passive: true },
    )
    this.board.addEventListener(
      "touchend",
      (e) => {
        if (!tracking) return
        tracking = false
        const t = e.changedTouches[0]
        const dx = t.clientX - sx
        const dy = t.clientY - sy
        const absX = Math.abs(dx)
        const absY = Math.abs(dy)
        if (Math.max(absX, absY) < 24) return
        if (absX > absY) this.handleMove(dx > 0 ? "right" : "left")
        else this.handleMove(dy > 0 ? "down" : "up")
      },
      { passive: true },
    )

    this.root
      .querySelector("#new")
      ?.addEventListener("click", () => this.start())
    this.root
      .querySelector("#overNew")
      ?.addEventListener("click", () => this.start())
    this.root
      .querySelector("#winNew")
      ?.addEventListener("click", () => this.start())
    this.root
      .querySelector("#winKeep")
      ?.addEventListener("click", () => this.hideOverlay(this.overlayWin))
    this.undoBtn.addEventListener("click", () => this.undo())
  }
}

const SHELL = `
<div class="aurora"></div>
<div class="shell">
  <div class="topbar">
    <div class="brand">
      <h1>2048</h1>
      <p>Aurora edition</p>
    </div>
    <div class="scores">
      <div class="score-box" id="scoreBox">
        <span class="label">Score</span>
        <span class="value" id="score">0</span>
      </div>
      <div class="score-box">
        <span class="label">Best</span>
        <span class="value" id="best">0</span>
      </div>
    </div>
  </div>
  <div class="toolbar">
    <p class="hint">Join the tiles, reach <b>2048</b></p>
    <div class="actions">
      <button class="btn" id="undo" disabled>Undo</button>
      <button class="btn btn-primary" id="new">New Game</button>
    </div>
  </div>
</div>
<div class="board-frame" id="board-frame">
  <div class="board" id="board">
    <div class="cells" id="cells"></div>
    <div class="tiles" id="tiles"></div>
    <div class="overlay win" id="overlayWin">
      <h2>You win!</h2>
      <p>You reached 2048. Keep going for a higher score.</p>
      <div class="ov-actions">
        <button class="btn" id="winKeep">Keep Going</button>
        <button class="btn btn-primary" id="winNew">New Game</button>
      </div>
    </div>
    <div class="overlay over" id="overlayOver">
      <h2>Game Over</h2>
      <p>No moves left.</p>
      <div class="ov-actions">
        <button class="btn btn-primary" id="overNew">Try Again</button>
      </div>
    </div>
  </div>
</div>
<div class="dpad">
  <button class="up" data-dir="up" aria-label="Up">&#8593;</button>
  <button class="left" data-dir="left" aria-label="Left">&#8592;</button>
  <button class="right" data-dir="right" aria-label="Right">&#8594;</button>
  <button class="down" data-dir="down" aria-label="Down">&#8595;</button>
</div>
<div class="foot">
  <span class="keys">Move with <kbd>&#8592;</kbd> <kbd>&#8593;</kbd> <kbd>&#8594;</kbd> <kbd>&#8595;</kbd>, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, or swipe</span>
</div>
`

type Snapshot = { grid: Grid; score: number }

function loadBest(): number {
  const raw = localStorage.getItem(BEST_KEY)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) ? n : 0
}

function saveBest(value: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(value))
  } catch {
    /* ignore storage errors */
  }
}

function require<T extends HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const el = root.querySelector<T>(selector)
  if (!el) throw new Error(`Missing element ${selector}`)
  return el
}
