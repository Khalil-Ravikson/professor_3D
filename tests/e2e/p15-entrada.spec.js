// Prompt 07, V2: cada personagem abre o visualizador com o SEU clipe de entrada (aprovado pelo dono em 08/10/2026).
// Luma: aceno uma vez e depois o loop mostrar-corpo, giro, sinal-paz. Teo: pose-modelo, repetida. Os dois são diferentes.
import { test, expect } from '@playwright/test';

async function abrir(page, personagem) {
  await page.addInitScript((id) => { localStorage.clear(); localStorage.setItem('prof3d_personagem', id); localStorage.setItem('prof3d_motor', 'webspeech'); }, personagem);
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
}
const clipeAtivo = (page, id) => page.evaluate((x) => window.__prof3d.catalogo.clipes.some((c) => c.id === x && c.status === 'ativo'), id);

test('Luma abre o visualizador acenando e depois segue a lista dela', async ({ page }) => {
  await abrir(page, 'luma');
  test.skip(!(await clipeAtivo(page, 'aceno')), 'o clipe aceno não está ativo neste catálogo');
  await page.evaluate(() => window.__prof3d.visualizador.entrar({ tocarAgora: true }));
  await page.waitForFunction(() => window.__prof3d.visualizador.estado.clipe && window.__prof3d.visualizador.estado.tocando, null, { timeout: 30_000 });
  const e = await page.evaluate(() => { const v = window.__prof3d.visualizador.estado; return { clipe: v.clipe.id, modo: v.modo, restringir: v.restringir, pendente: v.entradaPendente, lacuna: v.lacuna }; });
  expect(e.clipe).toBe('aceno');
  expect(e.modo).toBe('todos');
  expect(e.restringir).toEqual(['mostrar-corpo', 'giro', 'sinal-paz']);
  expect(e.pendente).toBe(true);
  // Terminado o aceno, o próximo clipe é o primeiro da lista dela, não o próximo do catálogo.
  await page.waitForFunction(() => window.__prof3d.visualizador.estado.clipe && window.__prof3d.visualizador.estado.clipe.id !== 'aceno', null, { timeout: 40_000 });
  expect(await page.evaluate(() => window.__prof3d.visualizador.estado.clipe.id)).toBe('mostrar-corpo');
  expect(await page.evaluate(() => window.__prof3d.visualizador.estado.entradaPendente)).toBe(false);
});

test('Teo abre na pose de modelo e a repete; é diferente da Luma', async ({ page }) => {
  await abrir(page, 'matematico');
  test.skip(!(await clipeAtivo(page, 'pose-modelo')), 'o clipe pose-modelo não está ativo neste catálogo');
  await page.evaluate(() => window.__prof3d.visualizador.entrar({ tocarAgora: true }));
  await page.waitForFunction(() => window.__prof3d.visualizador.estado.clipe && window.__prof3d.visualizador.estado.tocando, null, { timeout: 30_000 });
  const e = await page.evaluate(() => { const v = window.__prof3d.visualizador.estado; return { clipe: v.clipe.id, modo: v.modo, lacuna: v.lacuna }; });
  expect(e.clipe).toBe('pose-modelo');
  expect(e.modo).toBe('um'); // repetir um
  expect(e.lacuna).toBeNull();
});

test('sem regra de entrada, o visualizador abre no primeiro clipe e anda pela lista toda', async ({ page }) => {
  await abrir(page, 'luma');
  await page.evaluate(() => window.__prof3d.visualizador.definirEntrada(null));
  await page.evaluate(() => window.__prof3d.visualizador.entrar({ tocarAgora: true }));
  await page.waitForFunction(() => window.__prof3d.visualizador.estado.clipe, null, { timeout: 30_000 });
  const e = await page.evaluate(() => { const v = window.__prof3d.visualizador.estado; return { indice: v.indice, restringir: v.restringir, modo: v.modo }; });
  expect(e.indice).toBe(0);
  expect(e.restringir).toEqual([]);
  expect(e.modo).toBe('todos');
});

test('entrada com clipe indisponível cai para o idle e registra a lacuna', async ({ page }) => {
  await abrir(page, 'luma');
  await page.evaluate(() => window.__prof3d.visualizador.definirEntrada(() => ({ clipe: 'clipe-que-nao-existe', modo: 'repetir', loop: [] })));
  await page.evaluate(() => window.__prof3d.visualizador.entrar({ tocarAgora: true }));
  await page.waitForFunction(() => window.__prof3d.visualizador.estado.clipe, null, { timeout: 30_000 });
  const e = await page.evaluate(() => { const v = window.__prof3d.visualizador.estado; return { clipe: v.clipe.id, lacuna: v.lacuna }; });
  expect(e.clipe).toBe('idle');
  expect(e.lacuna).toBe('clipe-que-nao-existe');
});
