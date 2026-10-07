// Prompt 06: visualizador estilo VRoid Hub. Câmera livre, reset, rastreamento, tela cheia (só o fallback por CSS;
// a API de verdade vai para o roteiro manual) e loop de animações. Em paisagem e retrato.
import { test, expect } from '@playwright/test';

const TOLERANCIA_M = 0.02; // o reset devolve a câmera ao padrão com no máximo 2 cm de diferença
const ALVO_TOQUE = 56;

async function abrir(page, viewport = { width: 1280, height: 720 }) {
  await page.setViewportSize(viewport);
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript(() => {
    if (localStorage.getItem('prof3d_teste_viz')) return;
    localStorage.clear();
    localStorage.setItem('prof3d_teste_viz', 'sim');
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_motor', 'webspeech');
  });
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  return erros;
}

const entrar = (page, tocarAgora = false) => page.evaluate((t) => window.__prof3d.visualizador.entrar({ tocarAgora: t }), tocarAgora);
const cam = (page) => page.evaluate(() => {
  const c = window.__prof3d.cena;
  return { p: c.camera.position.toArray(), alvo: c.orbita ? c.orbita.target.toArray() : null };
});
const padrao = (page) => page.evaluate(() => { const a = window.__prof3d.cena.alvoPadrao(); return { p: a.posicao.toArray(), alvo: a.olhar.toArray() }; });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function arrastar(page, dx, dy) {
  const c = await page.locator('#stage canvas').boundingBox();
  const x = c.x + c.width / 2, y = c.y + c.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(300); // o amortecimento termina de assentar
}

for (const [nome, viewport] of [['paisagem', { width: 1280, height: 720 }], ['retrato', { width: 540, height: 960 }]]) {
  test(`visualizador: entrar, barra com rótulos e alvos de 56 px, sair (${nome})`, async ({ page }) => {
    const erros = await abrir(page, viewport);
    // O botão de entrada só existe na tela do personagem.
    await expect(page.locator('#vizEntrar')).toBeVisible();
    await page.click('#vizEntrar');
    await expect(page.locator('#viz')).toBeVisible();
    expect(await page.evaluate(() => document.getElementById('app').dataset.visualizador)).toBe('sim');
    expect(await page.evaluate(() => window.__prof3d.cena.orbitaAtiva)).toBe(true);
    await expect(page.locator('#vizBarra')).toHaveAttribute('aria-label', 'Controles do visualizador');

    // Todo botão tem nome acessível e alvo de 56 px ou mais; sem emoji nem travessão.
    const falhas = await page.evaluate((alvo) => {
      const ruins = [];
      for (const el of document.querySelectorAll('#vizBarra button, #vizBarra select, #vizEntrar')) {
        if (el.offsetParent === null) continue;
        const r = el.getBoundingClientRect(), nomeAcess = el.getAttribute('aria-label');
        if (!nomeAcess) ruins.push(`${el.id}: sem aria-label`);
        if (r.width < alvo - 1 || r.height < alvo - 1) ruins.push(`${el.id}: ${Math.round(r.width)}x${Math.round(r.height)}`);
        if (/[—\p{Extended_Pictographic}]/u.test(nomeAcess || '')) ruins.push(`${el.id}: emoji ou travessão no rótulo`);
      }
      return ruins;
    }, ALVO_TOQUE);
    expect(falhas, falhas.join('; ')).toEqual([]);
    // A barra cabe na tela, sem rolagem horizontal.
    const cabe = await page.evaluate(() => { const r = document.getElementById('vizBarra').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; });
    expect(cabe).toBe(true);
    await page.screenshot({ path: `relatorios/p13-visualizador-${nome}.png` });

    await page.click('#vizSair');
    await expect(page.locator('#viz')).toBeHidden();
    // Na conversa a câmera livre volta sozinha; o que o visualizador precisa soltar é o estado dele.
    expect(await page.evaluate(() => window.__prof3d.visualizador.ativo)).toBe(false);
    expect(await page.evaluate(() => document.getElementById('app').dataset.visualizador)).toBeUndefined();
    await page.evaluate(() => window.__prof3d.cena.orbitaAutomatica(false));
    expect(await page.evaluate(() => window.__prof3d.cena.orbitaAtiva), 'sem a câmera automática não sobra controle').toBe(false);
    expect(erros).toEqual([]);
  });
}

test('visualizador: girar a câmera à mão e voltar com o botão, o duplo clique e a tecla R', async ({ page }) => {
  await abrir(page);
  await entrar(page);
  const padraoCam = await padrao(page);
  // Começa no enquadramento padrão do personagem (campo enquadramento dos dados).
  const inicial = await cam(page);
  expect(dist(inicial.p, padraoCam.p)).toBeLessThan(TOLERANCIA_M);
  expect(dist(inicial.alvo, padraoCam.alvo)).toBeLessThan(TOLERANCIA_M);

  for (const como of ['botao', 'duploClique', 'tecla']) {
    await arrastar(page, 140, -60);
    const longe = await cam(page);
    expect(dist(longe.p, padraoCam.p), 'a câmera saiu do lugar').toBeGreaterThan(0.2);
    if (como === 'botao') await page.click('#vizReset');
    else if (como === 'duploClique') { const c = await page.locator('#stage canvas').boundingBox(); await page.mouse.dblclick(c.x + c.width / 2, c.y + c.height / 2); }
    else await page.keyboard.press('r');
    // 0,5 s de reset e mais um pouco para assentar.
    await page.waitForTimeout(900);
    const volta = await cam(page);
    expect(dist(volta.p, padraoCam.p), `posição depois do reset por ${como}`).toBeLessThan(TOLERANCIA_M);
    expect(dist(volta.alvo, padraoCam.alvo), `alvo depois do reset por ${como}`).toBeLessThan(TOLERANCIA_M);
  }
});

test('visualizador: o reset é suave, sem salto seco', async ({ page }) => {
  await abrir(page);
  await entrar(page);
  const padraoCam = await padrao(page);
  await arrastar(page, 200, 40);
  const antes = await cam(page);
  await page.click('#vizReset');
  // Amostra a posição durante o reset: tem que passar por pontos intermediários, não pular de uma vez.
  const amostras = await page.evaluate(() => new Promise((ok) => {
    const c = window.__prof3d.cena, v = []; const t0 = performance.now();
    const passo = () => { v.push({ t: performance.now() - t0, p: c.camera.position.toArray() }); if (performance.now() - t0 < 700) requestAnimationFrame(passo); else ok(v); };
    requestAnimationFrame(passo);
  }));
  const total = dist(antes.p, padraoCam.p);
  const meio = amostras.filter((a) => dist(a.p, antes.p) > total * 0.15 && dist(a.p, padraoCam.p) > total * 0.15);
  expect(meio.length, 'nenhuma amostra intermediária: foi um salto').toBeGreaterThanOrEqual(3);
  // E nunca andou mais de metade do caminho entre dois quadros seguidos.
  let maiorPasso = 0;
  for (let i = 1; i < amostras.length; i++) maiorPasso = Math.max(maiorPasso, dist(amostras[i].p, amostras[i - 1].p));
  expect(maiorPasso).toBeLessThan(total * 0.5);
});

test('visualizador: limites de distância e de ângulo vertical', async ({ page }) => {
  await abrir(page);
  await entrar(page);
  // Zoom máximo para dentro e para fora com a roda do mouse.
  const c = await page.locator('#stage canvas').boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -400);
  await page.waitForTimeout(600);
  const perto = await page.evaluate(() => { const o = window.__prof3d.cena.orbita; return o.object.position.distanceTo(o.target); });
  expect(perto).toBeGreaterThanOrEqual(0.69);
  for (let i = 0; i < 60; i++) await page.mouse.wheel(0, 600);
  await page.waitForTimeout(600);
  const longe = await page.evaluate(() => { const o = window.__prof3d.cena.orbita; return o.object.position.distanceTo(o.target); });
  expect(longe).toBeLessThanOrEqual(6.01);
  // Arrastar muito para cima e para baixo não vira a câmera de cabeça para baixo nem passa do chão.
  for (const dy of [-900, 900]) {
    await arrastar(page, 0, dy);
    const polar = await page.evaluate(() => (window.__prof3d.cena.orbita.getPolarAngle() * 180) / Math.PI);
    expect(polar).toBeGreaterThanOrEqual(14.9);
    expect(polar).toBeLessThanOrEqual(95.1);
  }
});

test('visualizador: rastreamento segue o ponto, e girar à mão pausa por 3 s', async ({ page }) => {
  await abrir(page);
  await entrar(page);
  await page.click('#vizSeguir');
  await expect(page.locator('#vizSeguir')).toHaveAttribute('aria-pressed', 'true');
  // Ponto de teste: a cabeça "foi" para 0,8 m à direita.
  await page.evaluate(() => { window.__alvoTeste = [0.8, 1.2, 0]; window.__prof3d.cena.definirSeguir((v) => v.set(...window.__alvoTeste)); });
  await page.waitForTimeout(2200);
  const seguiu = await cam(page);
  expect(Math.abs(seguiu.alvo[0] - 0.8), 'o alvo da câmera chegou perto do ponto').toBeLessThan(0.05);

  // Gira à mão: o rastreamento pausa. O ponto muda, e a câmera não o acompanha por 3 s.
  await arrastar(page, 40, 0);
  await page.evaluate(() => { window.__alvoTeste = [-0.8, 1.2, 0]; });
  await page.waitForTimeout(1500);
  const pausado = await cam(page);
  expect(Math.abs(pausado.alvo[0] - 0.8), 'pausado: o alvo não saiu do lugar').toBeLessThan(0.15);
  await page.waitForTimeout(3200);
  await page.waitForTimeout(1500);
  const retomou = await cam(page);
  expect(retomou.alvo[0], 'depois de 3 s o rastreamento retoma e vai para o novo ponto').toBeLessThan(0.2);
});

test('visualizador: teclado (R, T, F, Espaço, setas, Esc)', async ({ page }) => {
  await abrir(page);
  await entrar(page, true);
  const est = () => page.evaluate(() => { const e = window.__prof3d.visualizador.estado; return { tocando: e.tocando, seguir: e.seguir, indice: e.indice, ativo: e.ativo, cheia: e.telaCheiaCss }; });
  expect((await est()).tocando).toBe(true);
  await page.keyboard.press(' ');
  expect((await est()).tocando).toBe(false);
  await page.keyboard.press(' ');
  expect((await est()).tocando).toBe(true);
  await page.keyboard.press('t');
  expect((await est()).seguir).toBe(true);
  await page.keyboard.press('t');
  expect((await est()).seguir).toBe(false);
  const i0 = (await est()).indice;
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((i) => window.__prof3d.visualizador.estado.indice !== i, i0, { timeout: 15_000 });
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction((i) => window.__prof3d.visualizador.estado.indice === i, i0, { timeout: 15_000 });
  // Digitar num campo não aciona atalho.
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'campoTeste'; document.body.appendChild(i); i.focus(); });
  await page.keyboard.press('t');
  expect((await est()).seguir).toBe(false);
  await page.evaluate(() => document.getElementById('campoTeste').remove());
  await page.locator('#stage canvas').focus().catch(() => {});
  await page.keyboard.press('Escape');
  expect((await est()).ativo).toBe(false);
});

test('visualizador: loop em sequência, repetir um, aleatório, velocidade e pausa', async ({ page }) => {
  test.setTimeout(150_000);
  await abrir(page);
  await entrar(page, true);
  const est = () => page.evaluate(() => { const e = window.__prof3d.visualizador.estado; return { indice: e.indice, modo: e.modo, total: e.total, tocando: e.tocando, clipe: e.clipe && e.clipe.id }; });
  const e0 = await est();
  expect(e0.total).toBeGreaterThanOrEqual(3);
  // Só clipes ativos do catálogo.
  const naoAtivos = await page.evaluate(() => window.__prof3d.catalogo.clipes.filter((c) => c.status !== 'ativo').map((c) => c.id));
  expect(naoAtivos).not.toContain(e0.clipe);

  // Modo "todos" (padrão): um clipe de uma vez acaba e o seguinte entra sozinho. Velocidade 1,5x para acabar logo.
  await page.selectOption('#vizVel', '1.5');
  expect((await est()).tocando).toBe(true);
  await page.evaluate(() => window.__prof3d.visualizador.proximo()); // vai para o aceno (4,7 s, não repete)
  await page.waitForFunction(() => window.__prof3d.visualizador.estado.clipe && window.__prof3d.visualizador.estado.clipe.id === 'aceno', null, { timeout: 15_000 });
  const noAceno = (await est()).indice;
  await page.waitForFunction((i) => window.__prof3d.visualizador.estado.indice !== i, noAceno, { timeout: 30_000 });
  const depoisDoAceno = (await est()).indice;
  expect(depoisDoAceno).toBe(noAceno + 1);

  // Modo "um": repete o mesmo clipe, sem passar adiante.
  await page.click('#vizModo');
  expect((await est()).modo).toBe('aleatorio'); // todos -> aleatório
  await page.click('#vizModo');
  expect((await est()).modo).toBe('um');
  await expect(page.locator('#vizModo')).toHaveAttribute('data-modo', 'um');
  const fixo = (await est()).indice;
  await page.waitForTimeout(6000);
  expect((await est()).indice, 'repetir um clipe não passa para o seguinte').toBe(fixo);

  // Aleatório: o próximo é sempre outro clipe.
  await page.click('#vizModo'); // um -> todos
  await page.click('#vizModo'); // todos -> aleatório
  for (let k = 0; k < 4; k++) {
    const antes = (await est()).indice;
    await page.click('#vizProximo');
    await page.waitForFunction((i) => window.__prof3d.visualizador.estado.indice !== i, antes, { timeout: 15_000 });
  }

  // Pausa congela o clipe; retomar volta a andar.
  await page.click('#vizTocar');
  expect((await est()).tocando).toBe(false);
  const t1 = await page.evaluate(() => window.__prof3d.avatar.previa.tempo);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__prof3d.avatar.previa.tempo)).toBe(t1);
  await page.click('#vizTocar');
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__prof3d.avatar.previa.tempo)).not.toBe(t1);
});

test('visualizador: com "reduzir movimento" o loop começa pausado', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await abrir(page);
  await entrar(page, true);
  const e = await page.evaluate(() => window.__prof3d.visualizador.estado);
  expect(e.tocando).toBe(false);
  await expect(page.locator('#vizTocar')).toHaveAttribute('aria-pressed', 'false');
  // E o reset é imediato, sem animação.
  await arrastar(page, 120, 0);
  await page.click('#vizReset');
  await page.waitForTimeout(150);
  const padraoCam = await padrao(page);
  expect(dist((await cam(page)).p, padraoCam.p)).toBeLessThan(TOLERANCIA_M);
});

test('visualizador: aba oculta pausa o loop e a volta retoma', async ({ page }) => {
  await abrir(page);
  await entrar(page, true);
  expect(await page.evaluate(() => window.__prof3d.visualizador.estado.tocando)).toBe(true);
  const virar = (oculta) => page.evaluate((o) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => o });
    document.dispatchEvent(new Event('visibilitychange'));
  }, oculta);
  await virar(true);
  expect(await page.evaluate(() => window.__prof3d.visualizador.estado.tocando)).toBe(false);
  await virar(false);
  expect(await page.evaluate(() => window.__prof3d.visualizador.estado.tocando)).toBe(true);
});

test('visualizador: sem API de tela cheia usa o modo ampliado por CSS e avisa', async ({ page }) => {
  await abrir(page);
  await entrar(page);
  await page.evaluate(() => { const p = document.getElementById('stage'); p.requestFullscreen = undefined; p.webkitRequestFullscreen = undefined; });
  await page.keyboard.press('f');
  await expect(page.locator('#stage')).toHaveClass(/tela-cheia-css/);
  await expect(page.locator('#vizAviso')).toBeVisible();
  await expect(page.locator('#vizAviso')).toContainText('tela cheia');
  await expect(page.locator('#vizTelaCheia')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('f');
  await expect(page.locator('#stage')).not.toHaveClass(/tela-cheia-css/);
});

test('visualizador: trocar de personagem com ele aberto não vaza memória nem controles', async ({ page }) => {
  test.setTimeout(150_000);
  await abrir(page);
  await entrar(page, true);
  const mem = () => page.evaluate(() => { const m = window.__prof3d.cena.renderer.info.memory; return { g: m.geometries, t: m.textures, filhos: window.__prof3d.cena.scene.children.length }; });
  await page.evaluate(() => window.__prof3d.irPara(window.__prof3d.buscarPersonagem('matematico')));
  await page.waitForFunction(() => window.__prof3d.personagem.id === 'matematico' && document.getElementById('loading').hidden && !document.getElementById('stage').classList.contains('trocando'), null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__prof3d.visualizador.ativo)).toBe(true);
  expect(await page.evaluate(() => window.__prof3d.cena.orbitaAtiva)).toBe(true);
  // O loop continua no personagem novo.
  await page.waitForFunction(() => window.__prof3d.visualizador.estado.tocando && window.__prof3d.avatar.previa.ativa, null, { timeout: 30_000 });
  // Sair e entrar várias vezes: a cena não acumula nada.
  await page.evaluate(() => window.__prof3d.visualizador.sair());
  await page.waitForTimeout(500);
  const base = await mem();
  for (let i = 0; i < 8; i++) {
    await entrar(page, true);
    await page.waitForTimeout(150);
    await page.evaluate(() => window.__prof3d.visualizador.sair());
  }
  await page.waitForTimeout(500);
  const fim = await mem();
  expect(fim).toEqual(base);
  // A câmera livre automática da conversa pode estar de volta; desligada, não pode sobrar nenhum controle.
  await page.evaluate(() => window.__prof3d.cena.orbitaAutomatica(false));
  expect(await page.evaluate(() => window.__prof3d.cena.orbita)).toBeNull();
});

test('visualizador: a galeria do operador abre o visualizador tocando os clipes ligados', async ({ page }) => {
  await abrir(page);
  await page.click('#gear');
  await expect(page.locator('#galeriaVisualizador')).toHaveText('Abrir no visualizador');
  await page.click('#galeriaVisualizador');
  await expect(page.locator('#settings')).not.toBeVisible();
  await expect(page.locator('#viz')).toBeVisible();
  await page.waitForFunction(() => window.__prof3d.visualizador.estado.tocando && window.__prof3d.avatar.previa.ativa, null, { timeout: 30_000 });
});
