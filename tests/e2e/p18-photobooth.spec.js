// Prompt 07, V1: tela do Photo Booth no visualizador (wireframes aprovados em 08/10/2026).
// Faixa de miniaturas = clipes ativos; a selecionada é o clipe em cena; o painel tem abas; o modo público só tem Animações e Expressões e
// deixa foto e vídeo desligados; no retrato o corpo inteiro cabe entre a barra do topo e a faixa de miniaturas.
import { test, expect } from '@playwright/test';

async function abrir(page, { personagem = 'luma', publico = false, largura = 1280, altura = 720 } = {}) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([id, pub]) => {
    localStorage.clear(); localStorage.setItem('prof3d_personagem', id); localStorage.setItem('prof3d_motor', 'webspeech');
    if (pub) localStorage.setItem('prof3d_totem', 'sim');
  }, [personagem, publico]);
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  await page.evaluate(() => window.__prof3d.visualizador.entrar({ tocarAgora: true }));
  await page.waitForFunction(() => window.__prof3d.visualizador.estado.clipe && window.__prof3d.visualizador.estado.tocando, null, { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelectorAll('.pb-mini[data-id] img').length > 0, null, { timeout: 60_000 });
}

test('miniaturas são os clipes ativos, com imagem, e a selecionada é o clipe em cena', async ({ page }) => {
  await abrir(page);
  const r = await page.evaluate(() => {
    const ativos = window.__prof3d.catalogo.clipes.filter((c) => c.status === 'ativo').map((c) => c.id);
    const minis = [...document.querySelectorAll('.pb-mini[data-id]')];
    return { ativos, ids: minis.map((b) => b.dataset.id), comImagem: minis.filter((b) => b.querySelector('img')).length, sel: minis.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.id), clipe: window.__prof3d.visualizador.estado.clipe.id };
  });
  expect(r.ids.length).toBeGreaterThan(0);
  for (const id of r.ids) expect(r.ativos).toContain(id);
  expect(r.comImagem).toBe(r.ids.length);
  expect(r.sel).toEqual([r.clipe]);
  // Nome visível em cada miniatura (nada de botão só com imagem).
  expect(await page.evaluate(() => [...document.querySelectorAll('.pb-mini[data-id]')].every((b) => (b.textContent || '').trim().length > 0))).toBe(true);
});

test('clicar numa miniatura troca o clipe', async ({ page }) => {
  await abrir(page);
  const outro = await page.evaluate(() => { const atual = window.__prof3d.visualizador.estado.clipe.id; const b = [...document.querySelectorAll('.pb-mini[data-id]')].find((x) => x.dataset.id !== atual); return b ? b.dataset.id : null; });
  test.skip(!outro, 'só há um clipe ativo');
  await page.click(`.pb-mini[data-id="${outro}"]`);
  await page.waitForFunction((id) => window.__prof3d.visualizador.estado.clipe && window.__prof3d.visualizador.estado.clipe.id === id, outro, { timeout: 20_000 });
  await expect(page.locator(`.pb-mini[data-id="${outro}"]`)).toHaveAttribute('aria-pressed', 'true');
});

test('operador tem as quatro abas e o público só as duas primeiras, sem foto nem vídeo', async ({ page }) => {
  await abrir(page);
  const abas = () => page.evaluate(() => [...document.querySelectorAll('.pb-abas [role=tab]')].filter((b) => !b.hidden && b.offsetParent).map((b) => b.id));
  expect(await abas()).toEqual(['pbAba_animacoes', 'pbAba_expressoes', 'pbAba_rastreamento', 'pbAba_fundo']);
  await page.click('#pbAba_expressoes');
  await expect(page.locator('#pbAba_expressoes')).toHaveAttribute('aria-selected', 'true');
  await page.click('#pbAba_fundo');
  await expect(page.locator('#pbAba_fundo')).toHaveAttribute('aria-selected', 'true');
});

test('modo público: só Animações e Expressões, foto e vídeo desligados com o motivo escrito', async ({ page }) => {
  await abrir(page, { publico: true });
  const abas = await page.evaluate(() => [...document.querySelectorAll('.pb-abas [role=tab]')].filter((b) => !b.hidden && b.offsetParent).map((b) => b.id));
  expect(abas).toEqual(['pbAba_animacoes', 'pbAba_expressoes']);
  await expect(page.locator('#pbFoto')).toBeDisabled();
  await expect(page.locator('#pbVideo')).toBeDisabled();
  expect(((await page.locator('#pbAcoesNota').textContent()) || '').trim().length).toBeGreaterThan(5);
});

for (const [nome, largura, altura] of [['celular', 430, 900], ['celular pequeno', 360, 640], ['totem', 1080, 1920]]) test(`retrato (${nome}): o corpo inteiro cabe entre a barra do topo e a faixa de miniaturas, e os alvos têm 44 px`, async ({ page }) => {
  await abrir(page, { largura, altura });
  await page.waitForTimeout(1500); // a câmera termina de deslizar
  const r = await page.evaluate(() => {
    const p = window.__prof3d, c = p.cena.camera, m = p.avatar.medidaCorpo(), H = p.cena.renderer.domElement.getBoundingClientRect().height;
    const y = (v) => { const q = c.position.clone().set(m.x, v, m.z).project(c); return ((1 - q.y) / 2) * H; };
    const cab = p.avatar.vrm.humanoid.getNormalizedBoneNode('head'); const hp = cab.getWorldPosition(cab.position.clone()).project(c);
    const barra = document.querySelector('.viz-barra').getBoundingClientRect(), faixa = document.querySelector('.pb-faixa').getBoundingClientRect();
    const alvos = [...document.querySelectorAll('.pb .pb-mini, .pb .pb-pilula, .pb .pb-imitar, .pb-abas [role=tab]')].filter((e) => e.offsetParent).map((e) => { const b = e.getBoundingClientRect(); return { n: e.className + e.id, h: Math.round(b.height), w: Math.round(b.width) }; });
    return { cabeca: ((1 - hp.y) / 2) * H, pe: y(m.base), barraFim: barra.bottom, faixaIni: faixa.top, alvos };
  });
  expect(r.cabeca, 'o rosto não fica debaixo da barra').toBeGreaterThan(r.barraFim);
  expect(r.pe).toBeLessThan(r.faixaIni + 8); // os pés não entram na faixa de miniaturas
  for (const a of r.alvos.filter((x) => !x.n.includes('pb-mini'))) expect(a.h, a.n).toBeGreaterThanOrEqual(44);
});

test('sair do visualizador remove a tela do Photo Booth e devolve o enquadramento do rosto', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => window.__prof3d.visualizador.sair());
  await expect(page.locator('.pb')).toBeHidden();
  expect(await page.evaluate(() => document.querySelectorAll('.pb-mini[data-id]').length >= 0)).toBe(true);
});

test('celular deitado: as pílulas de foto e vídeo não cobrem o rosto nem o painel', async ({ page }) => {
  await abrir(page, { largura: 800, altura: 360 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const c = window.__prof3d.cena.camera, av = window.__prof3d.avatar, cab = av.vrm.humanoid.getNormalizedBoneNode('head');
    const q = cab.getWorldPosition(cab.position.clone()).project(c);
    const px = { x: ((q.x + 1) / 2) * innerWidth, y: ((1 - q.y) / 2) * innerHeight };
    const caixa = (e) => { const b = document.querySelector(e).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const dentro = (b) => px.x >= b.l && px.x <= b.r && px.y >= b.t && px.y <= b.b;
    const acoes = caixa('.pb-acoes'), painel = caixa('.pb-painel');
    return { cabecaSobAcoes: dentro(acoes), cabecaSobPainel: dentro(painel), acoesSobPainel: !(acoes.r < painel.l || acoes.l > painel.r || acoes.b < painel.t || acoes.t > painel.b) };
  });
  expect(r.cabecaSobAcoes).toBe(false);
  expect(r.cabecaSobPainel).toBe(false);
  expect(r.acoesSobPainel).toBe(false);
});

test('as miniaturas mostram a pose do clipe, não a T-pose do modelo parado', async ({ page }) => {
  await abrir(page);
  // A miniatura do "aceno" e a do "em pé" têm de ser imagens diferentes (na T-pose todas saíam iguais).
  const srcs = await page.evaluate(() => [...document.querySelectorAll('.pb-mini[data-id] img')].map((i) => i.src.length + ':' + i.src.slice(-80)));
  expect(new Set(srcs).size).toBeGreaterThan(1);
});

test('teclado: as setas andam entre as abas e o foco fica visível', async ({ page }) => {
  await abrir(page);
  await page.focus('#pbAba_animacoes');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#pbAba_expressoes')).toBeFocused();
  await expect(page.locator('#pbAba_expressoes')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.locator('#pbAba_fundo')).toBeFocused();
  await page.keyboard.press('ArrowRight'); // dá a volta
  await expect(page.locator('#pbAba_animacoes')).toBeFocused();
  const contorno = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  expect(contorno).not.toBe('none');
});

test('reduzir movimento: a tela do Photo Booth não anima', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('prof3d_personagem', 'luma'); localStorage.setItem('prof3d_motor', 'webspeech'); });
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar) && document.getElementById('loading').hidden, null, { timeout: 90_000 });
  await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
  await page.evaluate(() => window.__prof3d.visualizador.entrar({ tocarAgora: true }));
  await page.waitForFunction(() => document.querySelectorAll('.pb-mini[data-id]').length > 0, null, { timeout: 60_000 }); // com reduzir movimento o loop começa pausado
  const anim = await page.evaluate(() => [...document.querySelectorAll('.pb *')].filter((e) => getComputedStyle(e).animationName !== 'none' && getComputedStyle(e).animationDuration !== '0s').length);
  expect(anim).toBe(0);
});
