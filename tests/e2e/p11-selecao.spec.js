// Fase 5, marco I2: tela de seleção. Roleta, pódio em CSS, cartão com perfil, botão grande,
// troca por clique, teclado e deslize, retratos em cache no IndexedDB e 20 trocas sem vazar memória.
import { test, expect } from '@playwright/test';

const ALVO_TOQUE = 56; // regra I6 do prompt da fase 5

async function abrir(page, viewport) {
  await page.setViewportSize(viewport);
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED/.test(m.text())) erros.push(m.text()); }); // Kokoro (Docker) desligado: conexão recusada é do ambiente
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await page.addInitScript(() => {
    if (localStorage.getItem('prof3d_teste_p11')) return;
    localStorage.clear();
    localStorage.setItem('prof3d_teste_p11', 'sim');
    localStorage.setItem('prof3d_personagem', 'luma');
    localStorage.setItem('prof3d_motor', 'webspeech');
    localStorage.setItem('prof3d_vitrine_s', '60'); // a vitrine não troca de personagem no meio do teste
  });
  await page.goto('/?debug');
  await page.waitForFunction(
    () => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden,
    null, { timeout: 90_000 },
  );
  return erros;
}

async function irParaSelecao(page) {
  await page.click('#vitrineCta');
  await expect.poll(() => page.evaluate(() => window.__prof3d.etapa)).toBe('selecao');
  await page.waitForTimeout(900); // a câmera desliza do rosto para o corpo inteiro
}

for (const [nome, viewport] of [['paisagem', { width: 1280, height: 720 }], ['retrato', { width: 540, height: 960 }]]) {
  test(`I2 seleção: elenco, cartão e pódio (${nome})`, async ({ page }) => {
    const erros = await abrir(page, viewport);
    await irParaSelecao(page);

    // Dois ativos e dois bloqueados. Bloqueado tem cadeado, não é clicável e não mostra silhueta.
    const slots = await page.$$eval('#roleta .ret', (bs) => bs.map((b) => ({ id: b.dataset.id, off: b.disabled, rotulo: b.getAttribute('aria-label'), img: !!b.querySelector('img') })));
    expect(slots.map((s) => s.id)).toEqual(['luma', 'matematico', 'engenheiro', 'cientista']);
    expect(slots.map((s) => s.off)).toEqual([false, false, true, true]);
    expect(slots[2].rotulo).toBe('Rafa, em breve');
    expect(slots[3].rotulo).toBe('Nina, em breve');
    expect(slots[2].img || slots[3].img, 'personagem bloqueado não mostra retrato').toBe(false);

    // Cartão da Luma, vindo dos dados.
    await expect(page.locator('#selNome')).toHaveText('Luma');
    await expect(page.locator('#selConversar')).toHaveText('Conversar com Luma');
    await expect(page.locator('#selContador')).toHaveText('1/2');
    expect(await page.locator('#selPerfil li').count()).toBe(3);
    await expect(page.locator('#selFiccao')).toContainText('inventados para o jogo');
    // "Ouvir voz" fica desligado e diz por quê, até o marco I3.
    await expect(page.locator('#selOuvir')).toBeDisabled();
    await expect(page.locator('#selOuvirMotivo')).not.toBeEmpty();

    // O pódio é CSS: não há geometria nova na cena (3 luzes, modelo, alvo do olhar).
    expect(await page.evaluate(() => window.__prof3d.cena.scene.children.length)).toBe(6);

    // Corpo inteiro: os pés caem perto de 84% da altura do palco, onde o CSS põe o pódio.
    const pes = await page.evaluate(() => {
      const d = window.__prof3d, cam = d.cena.camera, m = d.avatar.medidaCorpo();
      const v = { x: m.x, y: m.base, z: m.z };
      const t = new (cam.position.constructor)(v.x, v.y, v.z).project(cam);
      const topo = new (cam.position.constructor)(m.x, m.topo, m.z).project(cam);
      return { pes: (1 - t.y) / 2, topo: (1 - topo.y) / 2 };
    });
    expect(pes.pes).toBeGreaterThan(0.78);
    expect(pes.pes).toBeLessThan(0.9);
    expect(pes.topo).toBeGreaterThan(0.08); // a cabeça fica abaixo da faixa de botões do topo

    // Alvos de toque do público: 56 px ou mais.
    const pequenos = await page.evaluate((alvo) => {
      const fora = [];
      for (const el of document.querySelectorAll('#selecao button:not(:disabled), #stage .gear, #stage .cam')) {
        if (el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.width < alvo - 1 || r.height < alvo - 1) fora.push(`${el.id || el.className}: ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return fora;
    }, ALVO_TOQUE);
    expect(pequenos, `alvos menores que ${ALVO_TOQUE}px: ${pequenos.join(', ')}`).toEqual([]);

    // Nada fica atrás de nada: o cartão não cobre o pódio. A geometria é a do CSS (#stage::before):
    // largura min(46%, 560 px), altura 11% do palco, topo em 84% menos 38% da própria altura.
    const cobre = await page.evaluate(() => {
      const c = document.getElementById('selCartao').getBoundingClientRect();
      const s = document.getElementById('stage').getBoundingClientRect();
      const larg = Math.min(s.width * 0.46, 560), alt = s.height * 0.11;
      const pod = { l: s.left + s.width / 2 - larg / 2, r: s.left + s.width / 2 + larg / 2, t: s.top + s.height * 0.84 - alt * 0.38 };
      pod.b = pod.t + alt;
      return c.left < pod.r && c.right > pod.l && c.top < pod.b && c.bottom > pod.t;
    });
    expect(cobre, 'o cartão não pode cobrir o pódio').toBe(false);

    // O que o operador precisa continua ao alcance do dedo: nenhuma faixa de texto cobre a engrenagem nem a câmera.
    const alcance = await page.evaluate(() => ['gear', 'camBtn'].map((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return topo && (topo.id === id || topo.closest('#' + id)) ? null : `${id} coberto por ${topo && (topo.id || topo.className || topo.tagName)}`;
    }).filter(Boolean));
    expect(alcance, alcance.join('; ')).toEqual([]);

    await page.screenshot({ path: `relatorios/p11-selecao-luma-${nome}.png` });
    expect(erros).toEqual([]);
  });
}

test('I2 seleção: trocar por clique, seta, teclado e deslize; botão grande começa a conversa', async ({ page }) => {
  const erros = await abrir(page, { width: 1280, height: 720 });
  await irParaSelecao(page);
  const id = () => page.evaluate(() => window.__prof3d.personagem.id);
  // `trocando` sai do palco quando o modelo novo está montado. Só `personagem.id` e `avatar` não bastam: o id muda
  // no começo da troca e o avatar antigo ainda existe até o fade acabar.
  const esperarTroca = (alvo) => page.waitForFunction((a) => window.__prof3d.personagem.id === a && document.getElementById('loading').hidden
    && !document.getElementById('stage').classList.contains('trocando') && !!window.__prof3d.avatar, alvo, { timeout: 60_000 });

  // Clique no retrato do Teo: o texto muda na hora, o modelo chega depois.
  await page.click('#roleta .ret[data-id="matematico"]');
  await expect(page.locator('#selNome')).toHaveText('Teo');
  await esperarTroca('matematico');
  await expect(page.locator('#roleta .ret[data-id="matematico"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#roleta .ret[data-id="luma"]')).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('#selConversar')).toHaveText('Conversar com Teo');
  await expect(page.locator('#selContador')).toHaveText('2/2');
  // A paleta vem dos dados do personagem.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--acao').trim())).toBe('#b3420f');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'relatorios/p11-selecao-teo-paisagem.png' });

  // Seta do cartão de vizinho: com dois ativos só existe um cartão, o "seguinte".
  await expect(page.locator('#selAnt')).toBeHidden();
  await page.click('#selProx');
  await esperarTroca('luma');

  // Teclado: setas andam pelo elenco.
  await page.focus('#roleta .ret[data-id="luma"]');
  await page.keyboard.press('ArrowDown');
  await esperarTroca('matematico');
  await page.keyboard.press('ArrowUp');
  await esperarTroca('luma');

  // Deslize no palco: para a esquerda avança, para a direita volta.
  const caixa = await page.locator('#stage').boundingBox();
  const y = caixa.y + caixa.height * 0.5, xm = caixa.x + caixa.width * 0.5;
  await page.mouse.move(xm + 80, y); await page.mouse.down(); await page.mouse.move(xm - 80, y, { steps: 6 }); await page.mouse.up();
  await esperarTroca('matematico');
  await page.mouse.move(xm - 80, y); await page.mouse.down(); await page.mouse.move(xm + 80, y, { steps: 6 }); await page.mouse.up();
  await esperarTroca('luma');
  // Deslize curto não troca.
  await page.mouse.move(xm, y); await page.mouse.down(); await page.mouse.move(xm - 20, y, { steps: 3 }); await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await id()).toBe('luma');

  // Bloqueado não responde.
  await expect(page.locator('#roleta .ret[data-id="engenheiro"]')).toBeDisabled();

  // Botão grande: começa a sessão com o mesmo personagem, sem recarregar o modelo.
  const mesmoModelo = await page.evaluate(() => { window.__antes = window.__prof3d.avatar.vrm.scene.uuid; return true; });
  expect(mesmoModelo).toBe(true);
  await page.click('#selConversar');
  await expect.poll(() => page.evaluate(() => window.__prof3d.etapa)).toBe('cumprimento');
  expect(await page.evaluate(() => window.__prof3d.avatar.vrm.scene.uuid === window.__antes)).toBe(true);
  await expect(page.locator('#selecao')).toBeHidden();
  expect(erros).toEqual([]);
});

test('I2 seleção: o Tab alcança os controles, na ordem, com anel de foco', async ({ page }) => {
  await abrir(page, { width: 1280, height: 720 });
  await irParaSelecao(page);
  const ordem = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.dataset.id || ''));
    if (id) ordem.push(id);
  }
  for (const esperado of ['selComoFunciona', 'luma', 'matematico', 'selOuvir', 'selProx', 'selConversar']) {
    // selOuvir está desabilitado e fica fora do Tab: o teste só exige o que é focável.
    if (esperado === 'selOuvir') continue;
    expect(ordem, `${esperado} não recebeu foco; ordem: ${ordem.join(' > ')}`).toContain(esperado);
  }
  // O botão de conversar tem o anel de foco na caixa (o clip-path cortaria um contorno no próprio botão).
  await page.focus('#selConversar');
  const anel = await page.evaluate(() => getComputedStyle(document.getElementById('selConversar').parentElement, null).outlineStyle);
  expect(['solid', 'auto']).toContain(anel);
});

test('I2 seleção: 20 trocas seguidas sem erro e sem crescer a memória', async ({ page }) => {
  test.setTimeout(240_000);
  const erros = await abrir(page, { width: 1280, height: 720 });
  await irParaSelecao(page);
  const cdp = await page.context().newCDPSession(page);
  const medir = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    return page.evaluate(() => {
      const { geometries, textures } = window.__prof3d.cena.renderer.info.memory;
      return { heapMb: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), geometries, textures, filhos: window.__prof3d.cena.scene.children.length };
    });
  };
  // Duas voltas de aquecimento: o primeiro ciclo enche caches legítimos (clipes, retratos).
  const trocar = async (id) => {
    await page.evaluate((a) => window.__prof3d.irPara(window.__prof3d.buscarPersonagem(a)), id);
    await page.waitForFunction((a) => window.__prof3d.personagem.id === a && document.getElementById('loading').hidden && !!window.__prof3d.avatar, id, { timeout: 60_000 });
  };
  for (const id of ['matematico', 'luma', 'matematico', 'luma']) await trocar(id);
  await page.waitForTimeout(800);
  const antes = await medir();
  for (let i = 0; i < 20; i++) await trocar(i % 2 === 0 ? 'matematico' : 'luma');
  await page.waitForTimeout(800);
  const depois = await medir();
  console.log('antes', JSON.stringify(antes), 'depois', JSON.stringify(depois));
  expect(depois.filhos).toBe(6);
  expect(depois.geometries).toBe(antes.geometries);
  expect(depois.textures).toBe(antes.textures);
  expect(depois.heapMb - antes.heapMb, `heap subiu de ${antes.heapMb} para ${depois.heapMb} MB`).toBeLessThan(8);
  expect(erros).toEqual([]);
});

test('I2 retratos: renderizados uma vez e guardados no IndexedDB, não a cada abertura', async ({ page }) => {
  test.setTimeout(180_000);
  await abrir(page, { width: 1280, height: 720 });
  await page.waitForFunction(() => window.__prof3d.retratos.size >= 2, null, { timeout: 120_000 });
  const guardados = await page.evaluate(() => new Promise((ok, falha) => {
    const req = indexedDB.open('prof3d');
    req.onsuccess = () => {
      const tx = req.result.transaction('miniaturas', 'readonly');
      const todos = tx.objectStore('miniaturas').getAll();
      todos.onsuccess = () => { req.result.close(); ok(todos.result.map((r) => ({ id: r.id, versao: r.versao, bytes: r.url.length }))); };
      todos.onerror = () => falha(todos.error);
    };
    req.onerror = () => falha(req.error);
  }));
  expect(guardados.map((g) => g.id).sort()).toEqual(['luma', 'matematico']);
  expect(guardados.every((g) => g.versao && g.bytes > 500)).toBe(true);
  // Nada vai para o localStorage (cota de 5 MB e retrato em data URL não combinam).
  expect(await page.evaluate(() => localStorage.getItem('prof3d_miniaturas_v2'))).toBeNull();

  // Segunda abertura: os dois retratos saem do cache. Só o .vrm do personagem em cena é baixado inteiro;
  // gerar o retrato do Teo exigiria baixar o .vrm dele também.
  const baixados = [];
  page.on('response', (r) => { if (/\.vrm$/.test(r.url()) && r.request().method() === 'GET') baixados.push(r.url()); });
  await page.reload();
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.retratos.size >= 2), null, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  const nomes = baixados.map((u) => u.split('/').pop());
  expect(nomes, `baixou: ${nomes.join(', ')}`).toEqual(['8590256991748008892.vrm']);
});
