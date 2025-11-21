// 2048 Game Logic

interface Tile {
  id: string
  value: number
  position: { row: number; col: number }
  mergedFrom: Tile[] | null
  element: HTMLElement
}

class Game2048 {
  private grid: (Tile | null)[][]
  private size: number
  private score: number
  private container: HTMLElement
  private tileContainer: HTMLElement
  private scoreElement: HTMLElement
  private nextId = 0

  constructor(containerElement: HTMLElement, size = 4) {
    this.container = containerElement
    this.tileContainer = document.getElementById(
      "tile-container",
    ) as HTMLElement
    this.scoreElement = document.getElementById("score") as HTMLElement
    this.size = size
    this.score = 0
    this.grid = this.createGrid()

    this.renderBackgroundGrid()
    this.addStartTiles()
    this.setupInputListeners()
    this.setupTouchListeners()

    document
      .getElementById("restart-btn")
      ?.addEventListener("click", () => this.restart())
  }

  private restart() {
    this.tileContainer.innerHTML = ""
    this.score = 0
    this.updateScore(0)
    this.grid = this.createGrid()
    this.addStartTiles()
  }

  private createGrid(): (Tile | null)[][] {
    return Array.from({ length: this.size }, () => Array(this.size).fill(null))
  }

  private renderBackgroundGrid() {
    const gridBackground = document.getElementById("grid-background")
    if (!gridBackground) return

    gridBackground.innerHTML = ""
    for (let i = 0; i < this.size * this.size; i++) {
      const cell = document.createElement("div")
      cell.className = "bg-[#cdc1b4] rounded-sm w-full h-full"
      gridBackground.appendChild(cell)
    }
  }

  private addStartTiles(startTiles = 2): void {
    for (let i = 0; i < startTiles; i++) {
      this.addRandomTile()
    }
  }

  private addRandomTile(): void {
    if (this.hasEmptyCell()) {
      const value = Math.random() < 0.9 ? 2 : 4
      const cell = this.randomEmptyCell()
      if (cell) {
        const tile = this.createTile(cell.row, cell.col, value)
        this.grid[cell.row][cell.col] = tile
        // Animation is handled by CSS class 'animate-pop' added in createTile
      }
    }
  }

  private hasEmptyCell(): boolean {
    return this.grid.some((row) => row.some((cell) => cell === null))
  }

  private randomEmptyCell(): { row: number; col: number } | null {
    const emptyCells = this.grid
      .flatMap((row, rowIndex) =>
        row.map((cell, colIndex) => ({
          row: rowIndex,
          col: colIndex,
          isEmpty: cell === null,
        })),
      )
      .filter((cell) => cell.isEmpty)

    if (emptyCells.length === 0) {
      return null
    }

    return emptyCells[Math.floor(Math.random() * emptyCells.length)]
  }

  private createTile(row: number, col: number, value: number): Tile {
    const element = document.createElement("div")
    const id = `tile-${this.nextId++}`

    this.updateTileVisuals(element, value, row, col)
    element.classList.add("animate-pop")

    this.tileContainer.appendChild(element)

    return {
      id,
      value,
      position: { row, col },
      mergedFrom: null,
      element,
    }
  }

  private updateTileVisuals(
    element: HTMLElement,
    value: number,
    row: number,
    col: number,
  ) {
    // Reset classes but keep base tile class
    element.className = `tile tile-${value <= 2048 ? value : "super"}`
    element.textContent = value.toString()

    // Calculate position
    // Gap is 0.75rem (12px), Padding is 0.75rem (12px)
    // We use calc to position perfectly regardless of container size
    // left = padding + col * (width + gap)
    // width = (100% - padding*2 - gap*(size-1)) / size

    // Simplified:
    // 100% of container width
    // Each cell takes 25% of the available space roughly
    // Let's use the logic:
    // position = col * 25%
    // But we need to account for gaps.
    // Actually, since we used calc(25% - 0.75rem) for width in CSS,
    // We can just use percentages for the 'slot' and add padding offset.

    // Let's try a precise calc approach:
    // The grid has 4 columns.
    // 0: 0.75rem
    // 1: 0.75rem + 1 * (25%) ? No.

    // Let's use the CSS variable approach for cleaner code if we were using a preprocessor,
    // but here direct style manipulation is fine.

    // Formula:
    // gap = 0.75rem
    // padding = 0.75rem
    // cell_size = (100% - 2*padding - (size-1)*gap) / size
    // pos = padding + index * (cell_size + gap)

    // Let's inject this as a CSS variable or just a calc string.
    // cell_size = (100% - 1.5rem - 2.25rem) / 4 = (100% - 3.75rem) / 4
    // pos(i) = 0.75rem + i * ((100% - 3.75rem)/4 + 0.75rem)

    const x = `calc(0.75rem + ${col} * ((100% - 3.75rem) / 4 + 0.75rem))`
    const y = `calc(0.75rem + ${row} * ((100% - 3.75rem) / 4 + 0.75rem))`

    element.style.left = x
    element.style.top = y
  }

  private setupInputListeners(): void {
    document.addEventListener("keydown", (event) => {
      if (event.key.startsWith("Arrow")) {
        event.preventDefault()
        switch (event.key) {
          case "ArrowUp":
            this.move("up")
            break
          case "ArrowDown":
            this.move("down")
            break
          case "ArrowLeft":
            this.move("left")
            break
          case "ArrowRight":
            this.move("right")
            break
        }
      }
    })
  }

  private setupTouchListeners(): void {
    let touchStartX = 0
    let touchStartY = 0

    this.container.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
      },
      { passive: false },
    )

    this.container.addEventListener(
      "touchend",
      (e) => {
        if (!e.changedTouches.length) return

        const touchEndX = e.changedTouches[0].clientX
        const touchEndY = e.changedTouches[0].clientY

        const dx = touchEndX - touchStartX
        const dy = touchEndY - touchStartY

        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal
          if (Math.abs(dx) > 30) {
            if (dx > 0) this.move("right")
            else this.move("left")
          }
        } else {
          // Vertical
          if (Math.abs(dy) > 30) {
            if (dy > 0) this.move("down")
            else this.move("up")
          }
        }
      },
      { passive: false },
    )
  }

  private move(direction: "up" | "down" | "left" | "right"): void {
    const vector = this.getVector(direction)
    const traversals = this.buildTraversals(vector)
    let moved = false

    this.prepareTiles()

    traversals.row.forEach((row) => {
      traversals.col.forEach((col) => {
        const cell = { row, col }
        const tile = this.grid[row][col]

        if (tile) {
          const positions = this.findFarthestPosition(cell, vector)
          const next = positions.next
            ? this.grid[positions.next.row][positions.next.col]
            : null

          if (next && next.value === tile.value && !next.mergedFrom) {
            const merged = this.createTile(
              positions.next!.row,
              positions.next!.col,
              tile.value * 2,
            )

            merged.mergedFrom = [tile, next]

            this.grid[positions.next!.row][positions.next!.col] = merged
            this.grid[row][col] = null

            // Move the *original* tile to the merge position visually
            this.updateTileVisuals(
              tile.element,
              tile.value,
              positions.next!.row,
              positions.next!.col,
            )

            // The 'next' tile is already there.

            // Hide the merged tile initially
            merged.element.style.zIndex = "20" // On top
            merged.element.style.opacity = "0" // Hide it but keep it in DOM
            merged.element.style.transform = "scale(0)"

            tile.position = positions.next!

            this.score += merged.value
            this.updateScore(this.score)

            // After transition, remove old tiles and show new one
            setTimeout(() => {
              if (this.tileContainer.contains(tile.element)) {
                this.tileContainer.removeChild(tile.element)
              }
              if (this.tileContainer.contains(next.element)) {
                this.tileContainer.removeChild(next.element)
              }
              merged.element.style.opacity = "1"
              merged.element.style.transform = "scale(1)"
              merged.element.classList.add("animate-pop")
            }, 100) // Wait for move transition (100ms) + buffer
          } else {
            this.moveTile(tile, positions.farthest)
          }

          if (!this.positionsEqual(cell, tile.position)) {
            moved = true
          }
        }
      })
    })

    if (moved) {
      setTimeout(() => {
        this.addRandomTile()
        if (!this.movesAvailable()) {
          this.gameOver()
        }
      }, 150) // Wait slightly longer than move transition
    }
  }

  private updateScore(score: number) {
    this.scoreElement.textContent = score.toString()
  }

  private getVector(direction: "up" | "down" | "left" | "right"): {
    row: number
    col: number
  } {
    const map = {
      up: { row: -1, col: 0 },
      down: { row: 1, col: 0 },
      left: { row: 0, col: -1 },
      right: { row: 0, col: 1 },
    }
    return map[direction]
  }

  private buildTraversals(vector: { row: number; col: number }): {
    row: number[]
    col: number[]
  } {
    const traversals = { row: [] as number[], col: [] as number[] }

    for (let i = 0; i < this.size; i++) {
      traversals.row.push(i)
      traversals.col.push(i)
    }

    if (vector.row === 1) traversals.row.reverse()
    if (vector.col === 1) traversals.col.reverse()

    return traversals
  }

  private prepareTiles(): void {
    this.grid.forEach((row) => {
      row.forEach((tile) => {
        if (tile) {
          tile.mergedFrom = null
        }
      })
    })
  }

  private findFarthestPosition(
    cell: { row: number; col: number },
    vector: { row: number; col: number },
  ): {
    farthest: { row: number; col: number }
    next: { row: number; col: number } | null
  } {
    let previous: { row: number; col: number }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      previous = cell
      cell = {
        row: previous.row + vector.row,
        col: previous.col + vector.col,
      }

      if (!this.withinBounds(cell) || !this.cellAvailable(cell)) {
        break
      }
    }

    return {
      farthest: previous,
      next: this.withinBounds(cell) ? cell : null,
    }
  }

  private withinBounds(position: { row: number; col: number }): boolean {
    return (
      position.row >= 0 &&
      position.row < this.size &&
      position.col >= 0 &&
      position.col < this.size
    )
  }

  private cellAvailable(cell: { row: number; col: number }): boolean {
    return !this.grid[cell.row][cell.col]
  }

  private moveTile(tile: Tile, position: { row: number; col: number }): void {
    this.grid[tile.position.row][tile.position.col] = null
    this.grid[position.row][position.col] = tile
    tile.position = position
    this.updateTileVisuals(tile.element, tile.value, position.row, position.col)
  }

  private positionsEqual(
    pos1: { row: number; col: number },
    pos2: { row: number; col: number },
  ): boolean {
    return pos1.row === pos2.row && pos1.col === pos2.col
  }

  private movesAvailable(): boolean {
    return this.hasEmptyCell() || this.tileMatchesAvailable()
  }

  private tileMatchesAvailable(): boolean {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const tile = this.grid[row][col]
        if (tile) {
          for (const vector of [
            { row: 0, col: 1 },
            { row: 1, col: 0 },
          ]) {
            const cell = { row: row + vector.row, col: col + vector.col }
            const other = this.withinBounds(cell)
              ? this.grid[cell.row][cell.col]
              : null
            if (other && other.value === tile.value) {
              return true
            }
          }
        }
      }
    }
    return false
  }

  private gameOver(): void {
    // Simple alert for now, could be a nice overlay
    setTimeout(() => {
      alert(`Game Over! Your score: ${this.score}`)
    }, 300)
  }
}

// Usage
const container = document.getElementById("game-container")
if (container) {
  new Game2048(container)
}
