// Gravador e repetidor de landmarks (prompt 7, "como testar sem a webcam"). Grava SÓ NÚMEROS (nunca vídeo nem imagem): serve para
// teste de regressão do retarget e para o dono mandar uma sessão curta para ajuste. Nada é enviado: o arquivo fica local.
const arred = (v) => Math.round(v * 1e4) / 1e4;
const lmNum = (lm) => lm.map((p) => [arred(p.x), arred(p.y), arred(p.z), arred(p.visibility ?? 1)]);

export function quadroDeNumeros(t, pose, maos = null, norm = null) {
  const q = { t: Math.round(t), pose: lmNum(pose) };
  if (norm && norm.length) q.norm = lmNum(norm); // pontos normalizados da pose: servem ao movimento do corpo e aos gestos
  if (maos) q.maos = { esq: maos.esq ? lmNum(maos.esq) : null, dir: maos.dir ? lmNum(maos.dir) : null };
  return q;
}
// Confere que o quadro tem só números dentro das listas (garantia de privacidade: nenhuma imagem passa por aqui).
export function soNumeros(q) {
  const ok = (v) => Number.isFinite(v);
  const lista = (l) => Array.isArray(l) && l.every((p) => Array.isArray(p) && p.length === 4 && p.every(ok));
  return ok(q.t) && lista(q.pose) && (!q.norm || lista(q.norm)) && (!q.maos || ((q.maos.esq === null || lista(q.maos.esq)) && (q.maos.dir === null || lista(q.maos.dir))));
}
export function deNumeros(q) {
  const lm = (l) => l.map(([x, y, z, visibility]) => ({ x, y, z, visibility }));
  return { t: q.t, pose: lm(q.pose), norm: q.norm ? lm(q.norm) : null, maos: q.maos ? { esq: q.maos.esq && lm(q.maos.esq), dir: q.maos.dir && lm(q.maos.dir) } : null };
}

export function criarGravador({ maxQuadros = 900 } = {}) { // 30 s a 30 quadros por segundo
  let quadros = [], t0 = null, gravando = false;
  return {
    iniciar() { quadros = []; t0 = null; gravando = true; },
    parar() { gravando = false; return quadros; },
    adicionar(tMs, pose, maos = null, norm = null) {
      if (!gravando || quadros.length >= maxQuadros) return false;
      if (t0 === null) t0 = tMs;
      quadros.push(quadroDeNumeros(tMs - t0, pose, maos, norm));
      return true;
    },
    get gravando() { return gravando; },
    get total() { return quadros.length; },
    serializar() { return JSON.stringify({ formato: 'landmarks-numeros-v1', criadoEm: new Date().toISOString().slice(0, 10), quadros }); },
  };
}

// Repete os quadros no ritmo original. agora/agendar são injetáveis para o teste não esperar de verdade.
export function criarRepetidor(quadros, aoQuadro, { agendar = (f, ms) => setTimeout(f, ms), aoFim = () => {} } = {}) {
  let i = 0, cancelado = false;
  const passo = () => {
    if (cancelado) return;
    if (i >= quadros.length) { aoFim(); return; }
    const q = quadros[i++];
    aoQuadro(deNumeros(q));
    if (i < quadros.length) agendar(passo, Math.max(0, quadros[i].t - q.t)); else aoFim();
  };
  return { iniciar() { cancelado = false; i = 0; passo(); }, cancelar() { cancelado = true; } };
}
export function lerSessao(texto) {
  const d = JSON.parse(texto);
  if (d.formato !== 'landmarks-numeros-v1' || !Array.isArray(d.quadros)) throw new Error('Arquivo de sessão inválido.');
  if (!d.quadros.every(soNumeros)) throw new Error('A sessão tem algo que não é número: recusada.');
  return d.quadros;
}
