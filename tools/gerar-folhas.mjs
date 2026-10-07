// Gera uma folha de contato por clipe .vrma (4 instantes) e um JSON com as medidas.
// Uso: python serve.py 8771 (em outro terminal) e depois node tools/gerar-folhas.mjs
// Saída: relatorios/folhas/<clipe>.png e relatorios/folhas/medidas.json
import { chromium } from '@playwright/test';
import { readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8771';
const VRM = process.env.VRM || 'assets/avatars/8590256991748008892.vrm';
const PASTAS = ['assets/animations', 'VRMA_MotionPack/VRMA_MotionPack/vrma'];
const SAIDA = process.env.SAIDA || 'relatorios/folhas';
const SO = (process.env.SO || '').split(',').filter(Boolean); // ex.: SO=idle,aceno,giro
mkdirSync(SAIDA, { recursive: true });

const clipes = PASTAS.filter(existsSync).flatMap((p) => readdirSync(p).filter((f) => f.endsWith('.vrma')).map((f) => join(p, f).replaceAll('\\', '/'))).filter((c) => !SO.length || SO.some((s) => c.includes(s)));
const args = process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader'];
const navegador = await chromium.launch({ args });
const page = await navegador.newPage({ viewport: { width: 1300, height: 560 } });
const medidas = {};
for (const c of clipes) {
  await page.goto(`${BASE}/tools/folha-contato.html?vrm=${encodeURIComponent(VRM)}&vrma=${encodeURIComponent(c)}`);
  await page.waitForSelector('body[data-pronto="1"]', { state: 'attached', timeout: 90_000 });
  const nome = basename(c, '.vrma');
  await page.screenshot({ path: join(SAIDA, nome + '.png'), fullPage: true });
  medidas[c] = await page.evaluate(() => window.__resultado);
  console.log(nome, JSON.stringify(medidas[c]));
}
writeFileSync(join(SAIDA, 'medidas.json'), JSON.stringify(medidas, null, 2));
await navegador.close();
