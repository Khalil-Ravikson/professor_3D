// Vetores [x, y, z] e quaternions [x, y, z, w] em arrays simples: o núcleo do rastreamento do corpo roda no Node nos testes,
// sem Three.js. Só o adaptador (rastreador.js) usa THREE.Quaternion para escrever nos ossos do VRM.
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a); return l < 1e-9 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l]; };
export const meio = (a, b) => mul(add(a, b), 0.5);
export const angulo = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))));

export const QID = [0, 0, 0, 1];
export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];
export const qNorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
export function qEixoAngulo(eixo, ang) {
  const e = norm(eixo), s = Math.sin(ang / 2);
  return [e[0] * s, e[1] * s, e[2] * s, Math.cos(ang / 2)];
}
// Rotação mínima que leva a direção `de` para a direção `para` (a torção em volta do osso fica indeterminada).
export function qDeParaDirecao(de, para) {
  const a = norm(de), b = norm(para);
  const d = dot(a, b);
  if (d > 0.999999) return QID;
  if (d < -0.999999) {
    // Opostos: gira 180 graus em volta de qualquer eixo perpendicular.
    let p = cross([1, 0, 0], a);
    if (len(p) < 1e-6) p = cross([0, 1, 0], a);
    return qEixoAngulo(p, Math.PI);
  }
  const c = cross(a, b);
  return qNorm([c[0], c[1], c[2], 1 + d]);
}
export function qRotaciona(q, v) {
  const r = qMul(qMul(q, [v[0], v[1], v[2], 0]), qConj(q));
  return [r[0], r[1], r[2]];
}
export function qAngulo(q) { return 2 * Math.acos(Math.min(1, Math.abs(q[3]))); }
export function qSlerp(a, b, t) {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (cos < 0) { cos = -cos; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (cos > 0.9995) return qNorm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
  const th = Math.acos(cos), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
}
// Limita o ângulo total da rotação a `max` (radianos), mantendo o eixo.
export function qLimitar(q, max) {
  const ang = qAngulo(q);
  return ang <= max ? q : qSlerp(QID, q, max / ang);
}
// Anda de `de` até `para` sem passar de `maxRad` (limite de velocidade angular num quadro).
export function qAndar(de, para, maxRad) {
  const d = qMul(qConj(de), para);
  return qMul(de, qLimitar(d, maxRad));
}
