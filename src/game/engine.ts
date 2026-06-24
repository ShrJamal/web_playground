/**
 * Pure 2048 game engine. No DOM, no side effects — just state + rules.
 */

const VECTORS: Record<Direction, Vec> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
}

export const TARGET = 2048

export class Tile {
  row: number
  col: number
  value: number
  previousPosition: Vec | null = null
  mergedFrom: [Tile, Tile] | null = null

  constructor(row: number, col: number, value: number) {
    this.row = row
    this.col = col
    this.value = value
  }

  savePosition(): void {
    this.previousPosition = { row: this.row, col: this.col }
  }
}

export class Grid {
  readonly size: number
  readonly cells: (Tile | null)[][]

  constructor(size: number, previous?: Grid) {
    this.size = size
    this.cells = previous ? previous.cells.map((r) => r.slice()) : this.empty()
  }

  empty(): (Tile | null)[][] {
    return Array.from({ length: this.size }, () =>
      Array.from({ length: this.size }, () => null as Tile | null),
    )
  }

  inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.size && col >= 0 && col < this.size
  }

  cell(row: number, col: number): Tile | null {
    return this.inBounds(row, col) ? this.cells[row][col] : null
  }

  set(row: number, col: number, tile: Tile | null): void {
    this.cells[row][col] = tile
    if (tile) {
      tile.row = row
      tile.col = col
    }
  }

  availableCells(): Vec[] {
    const cells: Vec[] = []
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (!this.cells[r][c]) cells.push({ row: r, col: c })
      }
    }
    return cells
  }

  randomAvailableCell(): Vec | null {
    const cells = this.availableCells()
    if (cells.length === 0) return null
    return cells[Math.floor(Math.random() * cells.length)]
  }

  hasFreeCells(): boolean {
    return this.availableCells().length > 0
  }

  tiles(): Tile[] {
    const list: Tile[] = []
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const t = this.cells[r][c]
        if (t) list.push(t)
      }
    }
    return list
  }

  clone(): Grid {
    const copy = new Grid(this.size)
    for (const t of this.tiles()) {
      copy.set(t.row, t.col, new Tile(t.row, t.col, t.value))
    }
    return copy
  }
}

export function spawnRandomTile(grid: Grid): Tile | null {
  const cell = grid.randomAvailableCell()
  if (!cell) return null
  const value = Math.random() < 0.9 ? 2 : 4
  const tile = new Tile(cell.row, cell.col, value)
  grid.set(cell.row, cell.col, tile)
  return tile
}

export function move(grid: Grid, dir: Direction): MoveResult {
  const vector = VECTORS[dir]
  const traversal = buildTraversal(dir, grid.size)
  let moved = false
  let score = 0
  let won = false

  for (const tile of grid.tiles()) {
    tile.savePosition()
    tile.mergedFrom = null
  }

  for (const row of traversal.rows) {
    for (const col of traversal.cols) {
      const tile = grid.cell(row, col)
      if (!tile) continue

      const { farthest, next } = findFarthestPosition(
        grid,
        { row, col },
        vector,
      )
      const nextTile = next ? grid.cell(next.row, next.col) : null

      if (
        next &&
        nextTile &&
        nextTile.value === tile.value &&
        !nextTile.mergedFrom
      ) {
        const merged = new Tile(next.row, next.col, tile.value * 2)
        merged.mergedFrom = [tile, nextTile]
        tile.row = next.row
        tile.col = next.col
        grid.set(row, col, null)
        grid.set(next.row, next.col, merged)
        score += merged.value
        if (merged.value >= TARGET) won = true
        moved = true
      } else if (farthest.row !== row || farthest.col !== col) {
        grid.set(row, col, null)
        grid.set(farthest.row, farthest.col, tile)
        moved = true
      }
    }
  }

  return { moved, score, won }
}

export function movesAvailable(grid: Grid): boolean {
  if (grid.hasFreeCells()) return true
  for (let r = 0; r < grid.size; r++) {
    for (let c = 0; c < grid.size; c++) {
      const tile = grid.cell(r, c)
      if (!tile) continue
      for (const v of Object.values(VECTORS)) {
        const neighbor = grid.cell(r + v.row, c + v.col)
        if (neighbor && neighbor.value === tile.value) return true
      }
    }
  }
  return false
}

export type Direction = "up" | "down" | "left" | "right"

type Vec = { row: number; col: number }

type MoveResult = { moved: boolean; score: number; won: boolean }

function buildTraversal(
  dir: Direction,
  size: number,
): { rows: number[]; cols: number[] } {
  const rows = Array.from({ length: size }, (_, i) => i)
  const cols = Array.from({ length: size }, (_, i) => i)
  if (dir === "down") rows.reverse()
  if (dir === "right") cols.reverse()
  return { rows, cols }
}

function findFarthestPosition(
  grid: Grid,
  start: Vec,
  vector: Vec,
): { farthest: Vec; next: Vec | null } {
  let prev: Vec = start
  let cell: Vec = { row: start.row + vector.row, col: start.col + vector.col }
  while (grid.inBounds(cell.row, cell.col) && !grid.cell(cell.row, cell.col)) {
    prev = cell
    cell = { row: cell.row + vector.row, col: cell.col + vector.col }
  }
  return {
    farthest: prev,
    next: grid.inBounds(cell.row, cell.col) ? cell : null,
  }
}
