// Tempo de carga em três situações (prompt 2, R3): sem cache, com cache e offline de verdade (rede desligada no navegador,
// não só a caixa do DevTools). Uso: node tools/medir-carga.mjs [repeticoes]   (servidor em 8771; sobe se não houver)
// Pronto = tela de carregamento escondida e a vitrine mostrando o personagem. Sem ?debug, porque o service worker
// fica desligado com ?debug. Grava relatorios/carga.json e imprime a tabela.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { writeFileSync, mkdirSync } from 'node:fs';

const PORTA = 8771, BASE = `http://localhost:${PORTA}/`;
const N = Number(process.argv[2]) || 3;

const atendendo = () => new Promise((ok) => { const s = createConnection({ port: PORTA, host: '127.0.0.1' }, () => { s.end(); ok(true); }); s.on('error', () => ok(false)); });
let servidor = null;
if (!(await atendendo())) {
  servidor = spawn('python', ['serve.py', String(PORTA)], { stdio: 'ignore' });
  for (let i = 0; i < 30 && !(await atendendo()); i++) await new Promise((r) => setTimeout(r, 300));
}

const args = process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader'];
const navegador = await chromium.launch({ args });
const mediana = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function carregar(page) {
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('loading').hidden && document.getElementById('vitNome').textContent.length > 0, null, { timeout: 120_000 });
  const ms = Date.now() - t0;
  // Lido pela própria página (PerformanceResourceTiming): tamanho dos recursos carregados. O transferSize NÃO entra na tabela:
  // numa primeira visita ele deu 1,2 MB para 32 MB de recursos, então não mede o que passou pela rede.
  const r = await page.evaluate(() => {
    const e = performance.getEntriesByType('resource');
    return { recursos: e.length, tamanho: e.reduce((s, x) => s + (x.encodedBodySize || 0), 0), transferido: e.reduce((s, x) => s + (x.transferSize || 0), 0) };
  });
  return { ms, ...r };
}

const resultado = { data: new Date().toISOString(), repeticoes: N, gpu: args[0], semCache: [], comCache: [], offline: [] };
for (let i = 0; i < N; i++) {
  // Sem cache: contexto novo, sem worker nem cache de HTTP (o servidor de desenvolvimento manda no-store).
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { localStorage.setItem('prof3d_motor', 'webspeech'); });
  const p = await ctx.newPage();
  resultado.semCache.push(await carregar(p));
  // Deixa o worker assumir e guardar o que a segunda carga pede.
  await p.reload(); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30_000 }).catch(() => {});
  await p.waitForTimeout(3000);
  resultado.comCache.push(await carregar(p));
  await ctx.setOffline(true);
  resultado.offline.push(await carregar(p));
  await ctx.close();
}
await navegador.close();
if (servidor) servidor.kill();

const linha = (nome, v) => ({
  situacao: nome, medianaMs: mediana(v.map((x) => x.ms)), melhorMs: Math.min(...v.map((x) => x.ms)), recursos: mediana(v.map((x) => x.recursos)),
  tamanhoMB: +(mediana(v.map((x) => x.tamanho)) / 1e6).toFixed(1),
});
resultado.tabela = [linha('sem cache (primeira visita)', resultado.semCache), linha('com cache (segunda visita)', resultado.comCache), linha('offline (rede desligada)', resultado.offline)];
mkdirSync('relatorios', { recursive: true });
writeFileSync('relatorios/carga.json', JSON.stringify(resultado, null, 2));
console.table(resultado.tabela);
