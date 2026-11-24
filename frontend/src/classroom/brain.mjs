// Small, fully local neural policy. No pretrained model or external runtime.
export function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export const INPUTS = 64;
export const HIDDEN = 64;
export const OUTPUTS = 20;

export class Brain {
  constructor(seed = 41) {
    const rng = random(seed);
    this.w1 = Float32Array.from({length: INPUTS * HIDDEN}, () => (rng() - .5) * .8);
    this.b1 = new Float32Array(HIDDEN);
    this.w2 = Float32Array.from({length: HIDDEN * OUTPUTS}, () => (rng() - .5) * .5);
    this.b2 = new Float32Array(OUTPUTS);
    this.examples = 0;
    this.updates = 0;
    this.lastLoss = 0;
  }
  forward(x) {
    if (x.length !== INPUTS || !Array.from(x).every(Number.isFinite)) throw new Error('Invalid observation');
    const hidden = new Float32Array(HIDDEN);
    const logits = new Float32Array(OUTPUTS);
    for (let j = 0; j < HIDDEN; j++) {
      let value = this.b1[j];
      for (let i = 0; i < INPUTS; i++) value += this.w1[j * INPUTS + i] * x[i];
      hidden[j] = Math.tanh(value);
    }
    for (let k = 0; k < OUTPUTS; k++) {
      let value = this.b2[k];
      for (let j = 0; j < HIDDEN; j++) value += this.w2[k * HIDDEN + j] * hidden[j];
      logits[k] = value;
    }
    const peak = Math.max(...logits);
    const probabilities = Array.from(logits, value => Math.exp(value - peak));
    const sum = probabilities.reduce((a, b) => a + b, 0);
    for (let k = 0; k < OUTPUTS; k++) probabilities[k] /= sum;
    const action = probabilities.indexOf(Math.max(...probabilities));
    return {hidden, probabilities, action};
  }
  learn(x, target, rate = .055) {
    if (!Number.isInteger(target) || target < 0 || target >= OUTPUTS) throw new Error('Invalid teacher target');
    const result = this.forward(x);
    const delta = result.probabilities.map((p, k) => p - Number(k === target));
    const dh = new Float32Array(HIDDEN);
    for (let j = 0; j < HIDDEN; j++) {
      let error = 0;
      for (let k = 0; k < OUTPUTS; k++) error += delta[k] * this.w2[k * HIDDEN + j];
      dh[j] = error * (1 - result.hidden[j] ** 2);
    }
    for (let k = 0; k < OUTPUTS; k++) {
      for (let j = 0; j < HIDDEN; j++) this.w2[k * HIDDEN + j] -= rate * delta[k] * result.hidden[j];
      this.b2[k] -= rate * delta[k];
    }
    for (let j = 0; j < HIDDEN; j++) {
      for (let i = 0; i < INPUTS; i++) this.w1[j * INPUTS + i] -= rate * dh[j] * x[i];
      this.b1[j] -= rate * dh[j];
    }
    this.examples++;
    this.updates++;
    this.lastLoss = -Math.log(Math.max(1e-12, result.probabilities[target]));
    return this.lastLoss;
  }
  get bytes() { return this.w1.byteLength + this.b1.byteLength + this.w2.byteLength + this.b2.byteLength; }
  serialize() {
    return {version: 2, shape: [INPUTS, HIDDEN, OUTPUTS], examples: this.examples, updates: this.updates, lastLoss: this.lastLoss,
      w1: [...this.w1], b1: [...this.b1], w2: [...this.w2], b2: [...this.b2]};
  }
  static restore(data) {
    if (data?.version !== 2 || JSON.stringify(data.shape) !== JSON.stringify([INPUTS, HIDDEN, OUTPUTS])) throw new Error('Incompatible brain');
    const brain = new Brain();
    for (const key of ['w1', 'b1', 'w2', 'b2']) {
      if (!Array.isArray(data[key]) || data[key].length !== brain[key].length || !data[key].every(v => Number.isFinite(v) && Math.abs(v) < 100)) throw new Error('Corrupt weights');
      brain[key].set(data[key]);
    }
    for (const key of ['examples', 'updates']) {
      if (!Number.isSafeInteger(data[key]) || data[key] < 0) throw new Error('Corrupt counters');
      brain[key] = data[key];
    }
    if (data.lastLoss !== undefined) {
      if (!Number.isFinite(data.lastLoss) || data.lastLoss < 0) throw new Error('Corrupt loss');
      brain.lastLoss = data.lastLoss;
    }
    return brain;
  }
  static upgrade(data) {
    if (data?.version === 2) return Brain.restore(data);
    if (data?.version !== 1 || JSON.stringify(data.shape) !== '[20,28,7]') throw new Error('Incompatible legacy brain');
    for (const [key, length] of [['w1',560],['b1',28],['w2',196],['b2',7]]) {
      if (!Array.isArray(data[key]) || data[key].length !== length || !data[key].every(v => Number.isFinite(v) && Math.abs(v) < 100)) throw new Error('Corrupt legacy weights');
    }
    const brain = new Brain();
    for (let j = 0; j < 28; j++) {
      for (let i = 0; i < INPUTS; i++) brain.w1[j * INPUTS + i] = i < 20 ? data.w1[j * 20 + i] : 0;
      brain.b1[j] = data.b1[j];
    }
    for (let k = 0; k < 7; k++) {
      for (let j = 0; j < HIDDEN; j++) brain.w2[k * HIDDEN + j] = j < 28 ? data.w2[k * 28 + j] : 0;
      brain.b2[k] = data.b2[k];
    }
    brain.examples = Number.isSafeInteger(data.examples) && data.examples >= 0 ? data.examples : 0;
    brain.updates = brain.examples;
    return brain;
  }
}
