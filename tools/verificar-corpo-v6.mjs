// Verifica mãos, movimento do corpo e gestos (prompt 7, V6) no Chromium SEM webcam, repetindo uma sessão SINTÉTICA de números:
// a mão direita da pessoa fechada em punho, o corpo andando para o lado e a mão acenando acima do cotovelo.
// Uso: python serve.py 8771 (outro terminal) e depois  node tools/verificar-corpo-v6.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:8771';
const nav = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 760, height: 1000 } });
const erros = [];
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|XNNPACK/.test(m.text())) erros.push(m.text().slice(0, 220)); });
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('prof3d_personagem', 'luma'); localStorage.setItem('prof3d_motor', 'webspeech'); });
await page.goto(BASE + '/?debug');
await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90000 });
await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
await page.waitForTimeout(2000);

// Sessão: 90 quadros a 30 por segundo. Pessoa de frente; norm = pose normalizada (y para baixo); mundo em metros.
const sessao = (opc) => {
  const quadros = [];
  const dedo = (lm, mcp, rad) => { // dedo saindo do pulso em +x, cada junta dobrada `rad`
    lm[mcp] = [0.09, 0, 0, 1]; let a = 0, p = lm[mcp];
    for (let k = 1; k <= 3; k++) { a += rad; p = [p[0] + 0.035 * Math.cos(a), p[1] + 0.035 * Math.sin(a), 0, 1]; lm[mcp + k] = p; }
  };
  const maoPunho = () => { const lm = Array.from({ length: 21 }, () => [0, 0, 0, 1]); for (let k = 1; k <= 4; k++) lm[k] = [0.03 * k, 0, 0.02 * k, 1]; for (const m of [5, 9, 13, 17]) dedo(lm, m, 1.2); return lm; };
  for (let i = 0; i < 90; i++) {
    const k = Math.min(1, i / 30);
    const pose = Array.from({ length: 33 }, () => [0, 0, 0, 1]);
    const norm = Array.from({ length: 33 }, () => [0.5, 0.5, 0, 1]);
    const set = (a, idx, x, y, z = 0, v = 1) => { a[idx] = [x, y, z, v]; };
    const cx = 0.5 + opc.andar * k; // centro do corpo na imagem
    set(pose, 11, 0.2, -0.5); set(pose, 12, -0.2, -0.5); set(pose, 23, 0.1, 0, 0, 0.1); set(pose, 24, -0.1, 0, 0, 0.1);
    set(pose, 13, 0.2, -0.2); set(pose, 15, 0.2, 0.05); set(pose, 19, 0.2, 0.12); set(pose, 17, 0.18, 0.1);
    set(pose, 14, -0.2, -0.2); set(pose, 16, -0.2, 0.05); set(pose, 20, -0.2, 0.12); set(pose, 18, -0.18, 0.1);
    set(norm, 11, cx - 0.1, 0.4); set(norm, 12, cx + 0.1, 0.4); set(norm, 13, cx - 0.15, 0.55); set(norm, 14, cx + 0.15, 0.55);
    set(norm, 15, cx - 0.2, 0.7); set(norm, 16, cx + 0.2, 0.7);
    if (opc.acenar) { set(norm, 16, cx + 0.15 + 0.06 * Math.sin(i * 0.9), 0.42); } // pulso direito da pessoa acima do cotovelo, balançando
    const w = norm[16];
    const maoNorm = Array.from({ length: 21 }, () => [w[0], w[1], 0, 1]);
    quadros.push({ t: Math.round(i * 33), pose, norm, maos: { esq: null, dir: opc.punho ? maoPunho() : null }, _maoNorm: maoNorm });
  }
  return JSON.stringify({ formato: 'landmarks-numeros-v1', quadros });
};

// Mão: a repetição não leva a pose normalizada da mão; o emparelhamento já foi feito (esq e dir da pessoa).
async function rodar(nome, opc, espera = 9000) {
  await page.evaluate(() => { const c = window.__prof3d.corpo; c.desligar(); c.configurar({ espelho: true, gestos: true, pesos: { bracos: 1, tronco: 1, maos: 1, movimento: 1 } }); window.__prof3d.registroGestos.length = 0; });
  await page.evaluate((txt) => { window.__laco = true; const roda = () => window.__prof3d.corpo.repetir(txt, { aoFim: () => { if (window.__laco) roda(); } }); roda(); }, sessao(opc));
  await page.waitForTimeout(espera);
  const r = await page.evaluate(() => {
    const P = window.__prof3d, h = P.avatar.vrm.humanoid;
    const q = (n) => { const x = h.getNormalizedBoneNode(n); return x ? [x.quaternion.x, x.quaternion.y, x.quaternion.z, x.quaternion.w].map((v) => +v.toFixed(2)) : null; };
    return { dedoDir: q('rightIndexProximal'), dedoEsq: q('leftIndexProximal'), polegarEsq: q('leftThumbProximal'), cenaX: +P.avatar.vrm.scene.position.x.toFixed(3), cenaZ: +P.avatar.vrm.scene.position.z.toFixed(3), gestos: P.registroGestos.map((g) => g.msg).filter((m) => /usuario|aceno|comemora/.test(m)).slice(0, 4) };
  });
  await page.evaluate(() => { window.__laco = false; });
  await page.waitForTimeout(400);
  console.log(nome + ':', JSON.stringify(r));
  return r;
}

const punho = await rodar('punho fechado (mão direita da pessoa, espelho: mão esquerda do avatar)', { punho: true, andar: 0, acenar: false });
const andar = await rodar('corpo andando 0,12 da imagem para a direita da imagem', { punho: false, andar: 0.12, acenar: false });
const aceno = await rodar('aceno com a mão direita acima do cotovelo', { punho: false, andar: 0, acenar: true });
console.log('erros:', erros.length ? erros.slice(0, 4) : 'nenhum');
await nav.close();
