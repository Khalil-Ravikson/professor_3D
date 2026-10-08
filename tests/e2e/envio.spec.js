// Aba "Enviar movimento" e "Fixar no lugar". Usa arquivos que NÃO vão para o repositório
// (FBX do Mixamo e pacote VRoid); sem eles, o teste é pulado.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

const FBX = 'assets/animations/aceno2.fbx';
const VROID = 'VRMA_MotionPack/VRMA_MotionPack/vrma/VRMA_02.vrma';

async function abrir(page, limpar = true) {
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  if (limpar) {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('limpo')) return;
      sessionStorage.setItem('limpo', '1');
      localStorage.clear();
      indexedDB.deleteDatabase('prof3d');
      localStorage.setItem('prof3d_personagem', 'luma');
    });
  }
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar && window.__prof3d.diretor), null, { timeout: 60_000 });
  return erros;
}

test('envio de FBX do Mixamo: converte, mede, entra na galeria, vira o aceno e sobrevive ao recarregar', async ({ page }) => {
  test.skip(!existsSync(FBX), `sem ${FBX} (arquivo do Mixamo fica fora do repositório)`);
  await page.setViewportSize({ width: 1280, height: 720 });
  const erros = await abrir(page);
  await page.click('#gear');
  await page.click('#abas button[data-aba="animacoes"]'); // o envio de movimento e a galeria moram na aba Animações
  await page.setInputFiles('#envArquivo', FBX);
  await page.fill('#envNome', 'Aceno teste');
  await page.selectOption('#envUso', 'aceno');
  await page.click('#envEnviar');
  await expect(page.locator('#envSaida')).toContainText('Pronto', { timeout: 30_000 });
  const texto = await page.locator('#envSaida').textContent();
  console.log('saída do envio:', texto);
  await expect(page.locator('#galeria li[data-id^="env-aceno-teste"]')).toHaveCount(1);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'relatorios/envio-previa.png' });

  await page.reload();
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar && window.__prof3d.diretor), null, { timeout: 60_000 });
  await page.evaluate(() => window.__prof3d.iniciarSessao('operador'));
  await expect.poll(() => page.evaluate(() => window.__prof3d.registroGestos.map((r) => r.msg).join('|')), { timeout: 15_000 }).toMatch(/tocou "env-aceno-teste-[a-z0-9]+" \(fluxo\)/);

  // Apagar devolve o aceno ao do catálogo.
  await page.click('#gear');
  await page.click('#abas button[data-aba="animacoes"]'); // o envio de movimento e a galeria moram na aba Animações
  await page.locator('#galeria li[data-id^="env-aceno-teste"] .g-apagar').click();
  await expect(page.locator('#galeria li[data-id^="env-aceno-teste"]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('prof3d_estados_extra') || '{}'))).toEqual({});
  expect(erros).toEqual([]);
});

test('fixar no lugar: o quadril não sai do ponto num clipe que anda', async ({ page }) => {
  test.skip(!existsSync(VROID), 'sem o pacote VRoid');
  await abrir(page);
  const deslocamento = async () => page.evaluate(async () => {
    const av = window.__prof3d.avatar;
    const h = av.vrm.humanoid.getNormalizedBoneNode('hips');
    const p0 = h.position.clone(); const r = [p0.x, 0, p0.z];
    const clipe = await (await import('/src/avatar.js')).clipeDoArquivo('VRMA_MotionPack/VRMA_MotionPack/vrma/VRMA_02.vrma', av.vrm);
    av.previa.tocar(clipe);
    let max = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      max = Math.max(max, Math.hypot(h.position.x - r[0], h.position.z - r[2]));
      await new Promise((ok) => requestAnimationFrame(ok));
    }
    av.previa.parar();
    return max;
  });
  const fixo = await deslocamento();
  await page.evaluate(() => localStorage.setItem('prof3d_fixar_lugar', 'nao'));
  const solto = await deslocamento();
  console.log(`quadril: fixo ${fixo.toFixed(3)} m, solto ${solto.toFixed(3)} m`);
  expect(fixo).toBeLessThan(0.001);
  expect(solto).toBeGreaterThan(0.05);
});
