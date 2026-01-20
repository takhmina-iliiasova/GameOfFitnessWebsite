export class FitnessEngine {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.size = width * height;
    
    // 0 = Food/Empty, 1 = Organism, 2 = Depleted
    this.grid = new Uint8Array(this.size); 
    
    // --- DEFAULTS PER USER REQUEST ---
    this.level = 19;     // Rho (covers full 20x20 grid)
    this.alpha = 0;      // Alpha
    this.maxTimeSteps = 100; // Stop after 100 steps
    
    this.isRunning = false;
    this.generation = 0;
  }

  reset() {
    this.grid.fill(0); 
    this.generation = 0;
    
    // Start with 1 organism at exact center (10, 10 for 20x20 grid)
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    this.setCell(centerX, centerY, 1);
  }

  idx(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return -1;
    return y * this.width + x;
  }

  setCell(x, y, val) {
    const i = this.idx(x, y);
    if (i !== -1) this.grid[i] = val;
  }

  // Toggle cell state for manual placement
  toggleCell(x, y) {
    const i = this.idx(x, y);
    if (i !== -1) {
      // If it is Alive (1), make it Empty (0). 
      // If it is Empty (0) or Depleted (2), make it Alive (1).
      this.grid[i] = (this.grid[i] === 1) ? 0 : 1;
    }
  }

  step() {
    // STOP CONDITION: Max Time Steps
    if (this.generation >= this.maxTimeSteps) {
      this.isRunning = false;
      return;
    }

    this.generation++;

    // 1. Scan grid
    let organisms = []; 
    let depletedCount = 0;

    for (let i = 0; i < this.size; i++) {
      if (this.grid[i] === 1) organisms.push(i);
      else if (this.grid[i] === 2) depletedCount++;
    }

    const S = organisms.length;
    if (S === 0) {
        this.isRunning = false; // Extinction stop
        return; 
    }

    const availableTiles = this.size - depletedCount; 
    const emptyTiles = availableTiles - S; 

    // 2. Kelly Bet
    const p = availableTiles > 0 ? emptyTiles / availableTiles : 0;
    let b = Math.round(S * (2 * p - 1));
    if (b < 0) b = 0;

    // 3. Select Parents
    this.shuffleArray(organisms);
    const parents = organisms.slice(0, b);

    // 4. Reproduction
    const deaths = [];
    const births = [];
    const claimedThisTurn = new Set(); 

    for (let parentIdx of parents) {
      const px = parentIdx % this.width;
      const py = Math.floor(parentIdx / this.width);

      const targetIdx = this.chooseTile(px, py);

      if (
        targetIdx !== null && 
        this.grid[targetIdx] === 0 && 
        !claimedThisTurn.has(targetIdx)
      ) {
        births.push(targetIdx);
        claimedThisTurn.add(targetIdx);
      } else {
        deaths.push(parentIdx);
      }
    }

    // Apply updates
    for (let idx of deaths) this.grid[idx] = 2; 
    for (let idx of births) this.grid[idx] = 1; 
  }

  chooseTile(x, y) {
    const neighbors = this.getNeighbors(x, y, this.level);
    
    const available = []; 
    const empty = [];     

    for (let idx of neighbors) {
      if (this.grid[idx] !== 2) available.push(idx);
      if (this.grid[idx] === 0) empty.push(idx);
    }

    if (available.length === 0) return null;

    let candidates = available; 

    // Alpha Logic
    if (this.alpha === 1) {
       candidates = empty;
    } else if (empty.length > 0 && Math.random() < this.alpha) {
       candidates = empty;
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  getNeighbors(cx, cy, r) {
    const list = [];
    // If r >= max dimension, optimization to return entire grid minus self
    // This matches your Python logic for "level >= max(GRID_WIDTH)"
    if (r >= Math.max(this.width, this.height)) {
        for(let i=0; i<this.size; i++) {
            const tx = i % this.width;
            const ty = Math.floor(i / this.width);
            if (tx !== cx || ty !== cy) list.push(i);
        }
        return list;
    }

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        const idx = this.idx(cx + dx, cy + dy);
        if (idx !== -1) list.push(idx);
      }
    }
    return list;
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}