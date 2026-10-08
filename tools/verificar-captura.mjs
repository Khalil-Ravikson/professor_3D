// Verifica expressões manuais, olhar, foto e vídeo (prompt 7, V3 e V4) no Chromium e guarda os arquivos gerados em relatorios/captura/.
// Uso: python serve.py 8771 (outro terminal) e depois  node tools/verificar-captura.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8771';
mkdirSync('relatorios/captura', { recursive: true });
const nav = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const ctx = await nav.newContext({ viewport: { width: 900, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|XNNPACK/.test(m.text())) erros.push(m.text().slice(0, 200)); });
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('prof3d_personagem', 'luma'); localStorage.setItem('prof3d_motor', 'webspeech'); });
await page.goto(BASE + '/?debug');
await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90000 });
await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
await page.waitForTimeout(1500);

// V3: expressão manual sobrescreve a do clipe e some ao zerar; o olhar tem um dono só.
const expr = await page.evaluate(async () => {
  const a = window.__prof3d.avatar, em = a.vrm.expressionManager;
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const antes = em.getValue('happy');
  a.definirExpressaoManual('happy', 1); await esperar(1500);
  const com = em.getValue('happy');
  const visema = a.definirExpressaoManual('aa', 1); // visema: recusado, a boca falando manda
  a.zerarExpressoesManuais(); await esperar(1500);
  const depois = em.getValue('happy');
  a.definirOlhar({ modo: 'camera' }); const m1 = a.olhar.modo;
  a.definirOlhar({ modo: 'direcao', yaw: 0.5, pitch: 0.2 }); const m2 = a.olhar;
  a.definirOlhar({ modo: 'auto' });
  return { antes: +antes.toFixed(2), com: +com.toFixed(2), depois: +depois.toFixed(2), visemaAceito: visema, modos: [m1, m2.modo, m2.yaw, m2.pitch] };
});
console.log('expressão happy: antes', expr.antes, '| manual 100%', expr.com, '| depois de zerar', expr.depois, '| visema aceito?', expr.visemaAceito, '| olhar', JSON.stringify(expr.modos));

// V4: sem liberar, os botões ficam desligados; liberando, a foto sai com contagem.
await page.click('#gear'); await page.click('#abas button[data-aba="animacoes"]');
console.log('desligado por padrão:', await page.evaluate(() => [document.getElementById('fotoTirar').disabled, document.getElementById('videoGravar').disabled]));
await page.check('#fotoLiberar');
console.log('liberado:', await page.evaluate(() => [document.getElementById('fotoTirar').disabled, document.getElementById('videoGravar').disabled]), '| licença:', (await page.locator('#fotoLicenca').textContent()).slice(0, 140));
await page.selectOption('#fotoProporcao', '4:5');
const t0 = Date.now();
const [dlFoto] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#fotoTirar')]);
const nomeFoto = dlFoto.suggestedFilename();
await dlFoto.saveAs('relatorios/captura/' + nomeFoto);
console.log('foto:', nomeFoto, statSync('relatorios/captura/' + nomeFoto).size, 'bytes, em', ((Date.now() - t0) / 1000).toFixed(1), 's (contagem de 3 s)');

await page.fill('#fotoDuracao', '3'); await page.dispatchEvent('#fotoDuracao', 'change');
await page.selectOption('#fotoFundo', 'branco');
const [dlVideo] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#videoGravar')]);
const nomeVideo = dlVideo.suggestedFilename();
await dlVideo.saveAs('relatorios/captura/' + nomeVideo);
console.log('vídeo:', nomeVideo, statSync('relatorios/captura/' + nomeVideo).size, 'bytes');
console.log('rastreamento da câmera usado na captura? tracks ativas:', await page.evaluate(() => window.__prof3d.corpo.tracksAtivas));

// Bloqueio por modo totem.
await page.evaluate(() => localStorage.setItem('prof3d_totem', 'sim'));
await page.evaluate(() => document.getElementById('fotoLiberar').dispatchEvent(new Event('change')));
console.log('modo totem:', await page.evaluate(() => [document.getElementById('fotoTirar').disabled, document.getElementById('videoGravar').disabled]), '|', (await page.locator('#fotoLicenca').textContent()).slice(0, 40));
console.log('erros:', erros.length ? erros.slice(0, 4) : 'nenhum');
await nav.close();
