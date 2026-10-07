// Filtro One Euro (Casiez et al.): suaviza um sinal ruidoso sem atrasar os movimentos rápidos. Usado no rosto (camera.js) e no corpo (corpo/suavizacao.js).
export class FiltroOneEuro {
  constructor({ minCutoff = 1.0, beta = 0.02, dCutoff = 1.0 } = {}) {
    Object.assign(this, { minCutoff, beta, dCutoff });
    this.x = null; this.dx = 0; this.t = null;
  }
  static alfa(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filtrar(valor, tSeg) {
    if (this.x === null) { this.x = valor; this.t = tSeg; return valor; }
    const dt = Math.max(1e-3, tSeg - this.t);
    this.t = tSeg;
    const dxBruto = (valor - this.x) / dt;
    this.dx += FiltroOneEuro.alfa(this.dCutoff, dt) * (dxBruto - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += FiltroOneEuro.alfa(cutoff, dt) * (valor - this.x);
    return this.x;
  }
}
