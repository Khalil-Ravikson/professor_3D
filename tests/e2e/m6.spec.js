// M6: webcam. Sem câmera real aqui: (1) câmera falsa do Chromium (padrão de teste, sem rosto)
// e (2) um "rosto simulado": o próprio avatar da Luma renderizado num canvas e passado como
// MediaStream. Tudo o que é verificado aqui é SIMULADO; a câmera real precisa de teste manual.
import { test, expect } from '@playwright/test';

test.use({
  launchOptions: {
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      ...(process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
    ],
  },
});

async function abrir(page, extra = {}) {
  const erros = [];
  // O WASM do MediaPipe imprime avisos de inicialização (INFO/W...) no canal de erro.
  page.on('console', (m) => { if (m.type() === 'error' && !/^(INFO|W\d{4}|I\d{4}):?/.test(m.text())) erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await page.addInitScript((x) => { localStorage.clear(); for (const [c, v] of Object.entries(x)) localStorage.setItem('prof3d_' + c, v); }, extra);
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__prof3d && window.__prof3d.avatar, null, { timeout: 60_000 });
  return erros;
}

test('M6.1: câmera desligada por padrão; liga com clique, mostra indicador e para as tracks ao desligar', async ({ page }) => {
  const erros = await abrir(page);
  await expect(page.locator('#camBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#camAviso')).toBeHidden();
  expect(await page.evaluate(() => window.__prof3d.camera.ligada)).toBe(false);

  await page.click('#camBtn');
  await expect(page.locator('#camAviso')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#camBtn')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__prof3d.camera.tracksAtivas)).toBe(1);
  // Nenhum pedido de rede leva imagem: só baixa o modelo/wasm.
  await page.waitForTimeout(1500);

  await page.click('#camBtn');
  await expect(page.locator('#camAviso')).toBeHidden();
  expect(await page.evaluate(() => window.__prof3d.camera.ligada)).toBe(false);
  expect(await page.evaluate(() => window.__prof3d.camera.tracksAtivas)).toBe(0);
  await page.click('#gear');
  await expect(page.locator('#camPrivacidade')).toContainText('nunca sai deste computador');
  expect(erros).toEqual([]);
});

test('M6.2-4 (simulado): rosto do avatar num canvas -> presença, olhar acompanha, sorriso volta', async ({ page }) => {
  const enviados = [];
  page.on('request', (r) => { if (r.method() !== 'GET') enviados.push(r.url()); });
  const erros = await abrir(page, { cam_cumprimentar: 'sim' });

  // Fonte de vídeo: a Luma renderizada num canvas próprio (outra cena), de frente.
  await page.evaluate(async () => {
    const { criarCena } = await import('/src/scene.js');
    const av = await import('/src/avatar.js');
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:480px;height:480px;z-index:-1';
    document.body.appendChild(box);
    const cena = criarCena(box);
    cena.renderer.setClearColor(0xdddddd, 1);
    const { vrm } = await av.carregarVrm('assets/avatars/luma.vrm');
    const clipes = await av.carregarClipes({ idle: 'idle' }, vrm);
    const a = av.montarAvatar(vrm, cena, { bases: clipes });
    cena.definirFoco(a.posicaoCabeca, { distancia: 0.9, altura: 0.12 });
    cena.aoAtualizar((dt, t) => a.atualizar(dt, t));
    cena.iniciar();
    window.__falso = { cena, a, box, foco: a.posicaoCabeca.clone() };
    await window.__prof3d.camera.ligar({ fonte: cena.renderer.domElement.captureStream(15) });
  });

  await page.waitForFunction(() => window.__prof3d.presente, null, { timeout: 30_000 }).catch(() => {});
  const presente = await page.evaluate(() => window.__prof3d.presente);
  test.skip(!presente, 'O MediaPipe não reconheceu o rosto do avatar como rosto: presença, olhar e sorriso ficam para o teste com câmera real.');

  // Fase 5: o rosto chama a seleção, e não cumprimenta sozinho. A pessoa escolhe e aperta o botão grande.
  await expect.poll(() => page.evaluate(() => window.__prof3d.etapa)).toBe('selecao');
  await page.click('#selConversar');
  await expect(page.locator('#answer')).toHaveText('Oi! Que bom te ver. Quer me perguntar alguma coisa?');

  // Olhar: move a câmera do "rosto falso" para os lados e vê o yaw do lookAt do avatar principal mudar de sinal.
  const yawCom = async (dx) => page.evaluate(async (d) => {
    const { cena, foco } = window.__falso;
    cena.camera.position.x = foco.x + d; cena.camera.lookAt(foco.x + d, foco.y, foco.z);
    await new Promise((r) => setTimeout(r, 1500));
    return { yaw: window.__prof3d.avatar.vrm.lookAt.yaw, x: window.__prof3d.ultimaLeitura && window.__prof3d.ultimaLeitura.x };
  }, dx);
  const esq = await yawCom(-0.06), dir = await yawCom(0.06);
  const info = `câmera falsa à esquerda: rosto x=${esq.x?.toFixed(2)} yaw=${esq.yaw.toFixed(1)}; à direita: x=${dir.x?.toFixed(2)} yaw=${dir.yaw.toFixed(1)}`;
  console.log(info);
  // Rosto mais à direita na imagem = pessoa mais à esquerda da tela -> yaw menor (olha para a esquerda da tela).
  expect(Math.sign(esq.yaw - dir.yaw), info).toBe(-Math.sign(esq.x - dir.x));
  expect(Math.abs(esq.yaw - dir.yaw), info).toBeGreaterThan(5);

  // A cabeça vira para o lado do alvo (visível também no Teo, que tem viseira):
  // compara duas posições do rosto falso; a frente da cabeça tem que andar junto com o alvo.
  const medirCabeca = (d) => page.evaluate(async (dx) => {
    const THREE = await import('three');
    const { cena, foco } = window.__falso;
    cena.camera.position.x = foco.x + dx; cena.camera.lookAt(foco.x + dx, foco.y, foco.z);
    await new Promise((r) => setTimeout(r, 2000));
    const av = window.__prof3d.avatar, h = av.vrm.humanoid.getRawBoneNode('head');
    // VRM 0.x: o +Z do osso aponta para as costas (o modelo é girado 180° ao carregar).
    const z = av.vrm.meta && av.vrm.meta.metaVersion === '0' ? -1 : 1;
    const frente = new THREE.Vector3(0, 0, z).applyQuaternion(h.getWorldQuaternion(new THREE.Quaternion()));
    const alvo = av.vrm.lookAt.target.getWorldPosition(new THREE.Vector3());
    return { frenteX: frente.x, alvoX: alvo.x, giro: av.giroCabeca.yaw };
  }, d);
  const c1 = await medirCabeca(-0.07), c2 = await medirCabeca(0.07);
  const infoCab = `cabeça: alvo.x ${c1.alvoX.toFixed(2)} -> ${c2.alvoX.toFixed(2)}; frente.x ${c1.frenteX.toFixed(3)} -> ${c2.frenteX.toFixed(3)}; giro ${c1.giro.toFixed(3)} -> ${c2.giro.toFixed(3)} rad`;
  console.log(infoCab);
  expect(Math.sign(c2.frenteX - c1.frenteX), infoCab).toBe(Math.sign(c2.alvoX - c1.alvoX));
  expect(Math.abs(c2.giro - c1.giro), infoCab).toBeGreaterThan(0.05);

  // Espelho com rosto parado: a cabeça não acumula giro; ao desligar, volta.
  const giro = await page.evaluate(async () => {
    const THREE = await import('three');
    const h = window.__prof3d.avatar.vrm.humanoid.getNormalizedBoneNode('head');
    const q = () => h.quaternion.clone();
    window.__prof3d.camCfg.espelho = true;
    await new Promise((r) => setTimeout(r, 1000));
    const a = q();
    await new Promise((r) => setTimeout(r, 2000));
    const b = q();
    window.__prof3d.camCfg.espelho = false;
    window.__prof3d.avatar.espelhar(null);
    window.__prof3d.camera.desligar();
    await new Promise((r) => setTimeout(r, 2500));
    const c = q();
    return { deriva: a.angleTo(b), depois: c.angleTo(new THREE.Quaternion()) };
  });
  console.log(`espelho parado: variação em 2 s = ${giro.deriva.toFixed(3)} rad; depois de desligar, distância do neutro = ${giro.depois.toFixed(3)} rad`);
  expect(giro.deriva, 'sem giro acumulado').toBeLessThan(0.15);
  expect(giro.depois, 'volta ao neutro').toBeLessThan(0.05);
  await page.evaluate(() => window.__prof3d.camera.ligar({ fonte: window.__falso.cena.renderer.domElement.captureStream(15) }));
  await page.waitForTimeout(1500);

  // Sorriso: o avatar falso sorri (happy) e o principal reage.
  const sorrisoNeutro = await page.evaluate(() => window.__prof3d.ultimaLeitura.sorriso);
  await page.evaluate(() => { window.__falso.a.reagir(8); });
  const sorrisoMax = await page.evaluate(async () => {
    let m = 0; const t0 = performance.now();
    while (performance.now() - t0 < 3000) { m = Math.max(m, window.__prof3d.ultimaLeitura.sorriso || 0); await new Promise((r) => setTimeout(r, 60)); }
    return m;
  });
  console.log(`nota de sorriso do MediaPipe: neutro ${sorrisoNeutro.toFixed(2)}, avatar falso sorrindo ${sorrisoMax.toFixed(2)} (limiar 0,55)`);
  if (sorrisoMax >= 0.55) {
    await page.waitForFunction(() => window.__prof3d.avatar.reagindo, null, { timeout: 8_000 });
  } else {
    test.info().annotations.push({ type: 'limitação', description: `o sorriso do desenho só chega a ${sorrisoMax.toFixed(2)}; reação ao sorriso fica para o teste com câmera real` });
  }

  // Modo espelho (degrau 5): o sorriso do rosto falso aparece no avatar principal.
  const happyEspelho = await page.evaluate(async () => {
    window.__prof3d.camCfg.espelho = true;
    window.__falso.a.reagir(6);
    let m = 0; const t0 = performance.now();
    while (performance.now() - t0 < 2500) { m = Math.max(m, window.__prof3d.avatar.vrm.expressionManager.getValue('happy') || 0); await new Promise((r) => setTimeout(r, 60)); }
    window.__prof3d.camCfg.espelho = false;
    return m;
  });
  console.log(`espelho: happy no avatar principal chegou a ${happyEspelho.toFixed(2)}`);
  expect(happyEspelho).toBeGreaterThan(0.2);

  await page.evaluate(() => window.__prof3d.camera.desligar());
  expect(enviados.filter((u) => !/127\.0\.0\.1:8880|localhost:8771/.test(u)), 'nada da câmera é enviado').toEqual([]);
  expect(erros).toEqual([]);
});
