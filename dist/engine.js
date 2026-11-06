// Search logic is independent of animation and the DOM.
export function seededRandom(seed) {
  let s = 2166136261;
  for (const char of String(seed)) s = Math.imul(s ^ char.charCodeAt(0), 16777619);
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function attackingPairs(board) {
  let h = 0;
  for (let a = 0; a < board.length; a++)
    for (let b = a + 1; b < board.length; b++)
      if (board[a] === board[b] || Math.abs(board[a] - board[b]) === b - a) h++;
  return h;
}

export function attacks(board) {
  const pairs = [];
  for (let a = 0; a < board.length; a++)
    for (let b = a + 1; b < board.length; b++)
      if (board[a] === board[b] || Math.abs(board[a] - board[b]) === b - a) pairs.push([a, b]);
  return pairs;
}

export function queenNeighbors(board) {
  const result = [];
  for (let c = 0; c < board.length; c++) {
    for (let r = 0; r < board.length; r++) {
      if (r === board[c]) continue;
      const state = board.slice(); state[c] = r;
      result.push({ state, score: attackingPairs(state), move: { column: c, from: board[c], to: r } });
    }
  }
  return result;
}

export const landscapes = {
  multiwell: {
    name: 'Peaks & valleys', formula: 'f(x, y) = 0.28(x² + y²) + 1.9 sin(1.55x) cos(1.55y)',
    hint: 'Several valleys compete. A downhill path can stop far from the best valley.',
    fn: (x, y) => 0.28 * (x*x + y*y) + 1.9 * Math.sin(1.55*x) * Math.cos(1.55*y),
    start: [2.5, 1.75], optimum: null
  },
  bowl: {
    name: 'Smooth bowl', formula: 'f(x, y) = x² + y²',
    hint: 'One global minimum at (0, 0). A finite step can stop just short of it.',
    fn: (x, y) => x*x + y*y, start: [2.5, 1.75], optimum: 0
  },
  plateau: {
    name: 'Terraced plateau', formula: 'f(x, y) = ⌈2(x² + y²)⌉ / 2',
    hint: 'Flat terraces allow equal-cost moves; the sideways limit prevents endless wandering.',
    fn: (x, y) => Math.ceil(Math.max(0, x*x + y*y) * 2 - 1e-10) / 2,
    start: [0.75, 0.5], optimum: 0
  },
  rastrigin: {
    name: 'Rastrigin', formula: 'f(x, y) = 20 + x² + y² − 10 cos(2πx) − 10 cos(2πy)',
    hint: 'Many local minima surround the global minimum at (0, 0). Try different step sizes.',
    fn: (x, y) => 20 + x*x + y*y - 10*Math.cos(2*Math.PI*x) - 10*Math.cos(2*Math.PI*y),
    start: [2.5, 1.75], optimum: 0
  }
};

export function landscapeNeighbors(state, fn, step) {
  const result = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (!a && !b) continue;
    const x = +(state[0] + a * step).toFixed(8), y = +(state[1] + b * step).toFixed(8);
    if (x < -3 || x > 3 || y < -3 || y > 3) continue;
    result.push({ state: [x, y], score: fn(x, y), move: { dx: a*step, dy: b*step } });
  }
  return result;
}

export class HillSearch {
  constructor(config = {}, initial) {
    this.config = { mode: 'queens', n: 8, seed: '31415', sideways: true, sidewaysLimit: 8,
      autoRestart: true, maxRestarts: 20, function: 'multiwell', stepSize: 0.25, ...config };
    this.random = seededRandom(this.config.seed);
    this.history = []; this.neighbors = [];
    this.evaluations = 1; this.iteration = 0; this.restarts = 0; this.sidewaysCount = 0;
    this.sidewaysTotal = 0; this.pendingRestart = false; this.done = false;
    this.current = initial ? initial.slice() : this.randomState();
    this.score = this.evaluate(this.current); this.bestScore = this.score; this.bestState = this.current.slice();
    this.record('start', 'Initial state', 'Evaluate the starting state, then inspect its neighbors.');
    if (this.isOptimal()) { this.done = true; this.record('solved', 'Goal reached', 'The starting state already satisfies the objective.'); }
  }
  evaluate(state) {
    return this.config.mode === 'queens' ? attackingPairs(state) : landscapes[this.config.function].fn(...state);
  }
  isOptimal() {
    return this.config.mode === 'queens' ? this.score === 0 :
      landscapes[this.config.function].optimum !== null && Math.abs(this.score - landscapes[this.config.function].optimum) < 1e-8;
  }
  randomState() {
    if (this.config.mode === 'queens') return Array.from({ length: this.config.n }, () => Math.floor(this.random() * this.config.n));
    // Grid-aligned starts keep restart behavior reproducible for the selected step.
    const step = this.config.stepSize;
    return [0, 0].map(() => Math.max(-3, Math.min(3, Math.round((this.random()*6-3) / step) * step)));
  }
  record(kind, title, detail, extra = {}) {
    const snapshot = { kind, title, detail, state: this.current.slice(), score: this.score,
      bestScore: this.bestScore, bestState: this.bestState.slice(), iteration: this.iteration,
      restarts: this.restarts, sidewaysCount: this.sidewaysCount, sidewaysTotal: this.sidewaysTotal,
      evaluations: this.evaluations, pendingRestart: this.pendingRestart, done: this.done, ...extra };
    this.history.push(snapshot); return snapshot;
  }
  updateBest() {
    if (this.score < this.bestScore) { this.bestScore = this.score; this.bestState = this.current.slice(); }
  }
  restart(manual = false) {
    if (this.restarts >= this.config.maxRestarts) {
      this.pendingRestart = false; this.done = true;
      return this.record('limit', 'Restart limit reached', 'The search budget is exhausted. Change the seed or increase the restart limit.');
    }
    this.restarts++; this.sidewaysCount = 0; this.pendingRestart = false; this.done = false;
    this.current = this.randomState(); this.score = this.evaluate(this.current); this.evaluations++;
    this.neighbors = []; this.updateBest();
    if (this.isOptimal()) { this.done = true; return this.record('solved', 'Goal reached', 'The random restart landed on an optimal state.'); }
    return this.record('restart', 'Random restart', manual ? 'A new starting state was requested.' : 'The previous search was stuck. Start again from a new random state.');
  }
  step() {
    if (this.done) return this.history.at(-1);
    if (this.pendingRestart) return this.restart();
    if (this.iteration >= 3000) {
      this.done = true; return this.record('limit', 'Move limit reached', 'The 3,000-move limit prevents an unbounded animation. Start a new run.');
    }
    this.neighbors = this.config.mode === 'queens' ? queenNeighbors(this.current) :
      landscapeNeighbors(this.current, landscapes[this.config.function].fn, this.config.stepSize);
    this.evaluations += this.neighbors.length;
    const best = Math.min(...this.neighbors.map(n => n.score));
    const epsilon = 1e-8;
    const improving = best < this.score - epsilon;
    const equal = Math.abs(best - this.score) <= epsilon;
    const canSideways = equal && this.config.sideways && this.sidewaysCount < this.config.sidewaysLimit;
    if (improving || canSideways) {
      const choices = this.neighbors.filter(n => Math.abs(n.score - best) <= epsilon);
      const chosen = choices[Math.floor(this.random() * choices.length)];
      const previous = this.score;
      this.current = chosen.state.slice(); this.score = chosen.score; this.iteration++;
      this.sidewaysCount = improving ? 0 : this.sidewaysCount + 1;
      if (!improving) this.sidewaysTotal++;
      this.updateBest();
      if (this.isOptimal()) {
        this.done = true;
        return this.record('solved', 'Goal reached', this.config.mode === 'queens' ? 'Zero attacking pairs. Every queen is safe.' : 'The known global minimum of this function has been reached.', { move: chosen.move, previous });
      }
      const title = improving ? 'Improving move' : 'Sideways move';
      const detail = improving ? 'Choose a lowest-cost neighbor. Equal best choices are broken by the seeded random generator.' :
        `Cost is unchanged. Sideways move ${this.sidewaysCount} of ${this.config.sidewaysLimit} explores the plateau.`;
      return this.record(improving ? 'improve' : 'sideways', title, detail, { move: chosen.move, previous });
    }
    let title = equal ? 'Plateau: search stuck' : 'Local minimum';
    let detail = equal ? (!this.config.sideways ? 'Equal-cost neighbors exist, but sideways moves are disabled.' : 'The consecutive sideways-move limit has been reached.') :
      'Every available neighbor has a higher cost. A greedy improving move cannot escape.';
    if (this.config.mode === 'landscape') detail += ' This is relative to the eight sampled directions and selected step size.';
    this.pendingRestart = this.config.autoRestart && this.restarts < this.config.maxRestarts;
    this.done = !this.pendingRestart;
    detail += this.pendingRestart ? ' The next step triggers a random restart.' :
      (this.config.autoRestart ? ' The restart budget is exhausted.' : ' Random restarts are off.');
    return this.record('stuck', title, detail, { reason: equal ? 'plateau' : 'local-minimum' });
  }
}
