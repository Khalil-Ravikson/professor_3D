// Mede a fluidez dos dedos e da mão (prompt 7, V6) SEM webcam: repete uma sessão sintética de punho fechado com RUÍDO nos pontos da mão e QUADROS EM QUE A MÃO SOME
// (a detecção real pisca), uma vez com o comportamento antigo (fluido: false) e outra com o novo, e compara no avatar de verdade.
//   tremor  = variação média do ângulo do dedo entre dois quadros de render, enquanto o punho está fechado e parado (menor é melhor);
//   quedas  = vezes em que o dedo voltou a menos da metade da dobra durante o punho fechado (o "travou e soltou"; menor é melhor).
// Uso: python serve.py 8771 (outro terminal) e depois  node tools/medir-fluidez.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:8771';
function aleatorio(semente) { let a = semente; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

function sessao() {
  const r = aleatorio(7), quadros = [];
  const dedo = (lm, mcp, rad) => { lm[mcp] = [0.09, 0, (mcp - 11) * 0.01, 1]; /* dedos lado a lado em z, 2 cm entre cada; a dobra é no plano x-y */ let a = 0, p = lm[mcp]; for (let k = 1; k <= 3; k++) { a += rad; p = [p[0] + 0.035 * Math.cos(a), p[1] + 0.035 * Math.sin(a), p[2], 1]; lm[mcp + k] = p; } };
  const maoPunho = () => { const lm = Array.from({ length: 21 }, () => [0, 0, 0, 1]); for (let k = 1; k <= 4; k++) lm[k] = [0.03 * k, 0, 0.02 * k, 1]; for (const m of [5, 9, 13, 17]) dedo(lm, m, 1.2); return lm; };
  const base = maoPunho();
  let sumiu = 0;
  for (let i = 0; i < 300; i++) { // 10 s a 30 quadros por segundo
    const pose = Array.from({ length: 33 }, () => [0, 0, 0, 1]), norm = Array.from({ length: 33 }, () => [0.5, 0.5, 0, 1]);
    const set = (a, idx, x, y) => { a[idx] = [x, y, 0, 1]; };
    set(pose, 11, 0.2, -0.5); set(pose, 12, -0.2, -0.5); set(pose, 23, 0.1, 0); set(pose, 24, -0.1, 0);
    set(pose, 13, 0.2, -0.2); set(pose, 15, 0.2, 0.05); set(pose, 14, -0.2, -0.2); set(pose, 16, -0.2, 0.05);
    set(norm, 11, 0.4, 0.4); set(norm, 12, 0.6, 0.4); set(norm, 15, 0.3, 0.7); set(norm, 16, 0.7, 0.7);
    // Detecção que pisca: 12% dos quadros sem mão, e uma falha de 4 quadros a cada 2 segundos.
    if (sumiu > 0) sumiu--; else if (i % 60 === 45) sumiu = 4; else if (r() < 0.12) sumiu = 1;
    const mao = sumiu > 0 ? null : base.map(([x, y, z, v]) => [x + 0.004 * gauss(r), y + 0.004 * gauss(r), z + 0.004 * gauss(r), v]);
    quadros.push({ t: Math.round(i * 33), pose, norm, maos: { esq: null, dir: mao } });
  }
  return JSON.stringify({ formato: 'landmarks-numeros-v1', quadros });
}

const nav = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 520, height: 700 } });
const erros = []; page.on('pageerror', (e) => erros.push(e.message));
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('prof3d_personagem', 'luma'); localStorage.setItem('prof3d_motor', 'webspeech'); });
await page.goto(BASE + '/?debug');
await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90000 });
await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
await page.waitForTimeout(1500);
const txt = sessao();

async function rodar(fluido) {
  return page.evaluate(async ({ txt, fluido }) => {
    const P = window.__prof3d;
    P.corpo.desligar();
    const { criarRastreadorCorpo } = await import('/src/corpo/rastreador.js');
    const t = criarRastreadorCorpo({ obterAvatar: () => P.avatar, config: { fluido, espelho: false, gestos: false, pesos: { bracos: 1, tronco: 0, maos: 1, movimento: 0 } } });
    P.avatar.definirSobreposicao((dt) => t.aplicar(dt), () => t.restaurar());
    const osso = P.avatar.vrm.humanoid.getNormalizedBoneNode('rightIndexProximal'); // pessoa direita, sem espelho: mão direita do avatar
    const ang = () => 2 * Math.acos(Math.min(1, Math.abs(osso.quaternion.w)));
    const amostras = [];
    let fim = false;
    t.repetir(txt, { aoFim: () => { fim = true; } });
    const t0 = performance.now();
    await new Promise((res) => {
      const passo = () => { if (performance.now() - t0 > 2500) amostras.push(ang()); if (fim) res(); else requestAnimationFrame(passo); };
      requestAnimationFrame(passo);
    });
    t.desligar();
    const med = amostras.slice().sort((a, b) => a - b)[amostras.length >> 1];
    let soma = 0; for (let i = 1; i < amostras.length; i++) soma += Math.abs(amostras[i] - amostras[i - 1]);
    let quedas = 0, dentro = false;
    for (const a of amostras) { if (a < med * 0.5) { if (!dentro) quedas++; dentro = true; } else dentro = false; }
    return { amostras: amostras.length, mediana: +med.toFixed(3), tremor: +(soma / Math.max(1, amostras.length - 1)).toFixed(4), quedas };
  }, { txt, fluido });
}
const antigo = await rodar(false);
const novo = await rodar(true);
console.log('antigo:', JSON.stringify(antigo));
console.log('novo  :', JSON.stringify(novo));
console.log(`tremor ${antigo.tremor} -> ${novo.tremor}; quedas ${antigo.quedas} -> ${novo.quedas}. (render por software: poucos quadros por segundo, então os números valem para comparar os dois modos, não em valor absoluto)`);
console.log('erros:', erros.length ? erros.slice(0, 3) : 'nenhum');
await nav.close();
