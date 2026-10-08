// P9, acessibilidade: contraste das paletas de cada personagem.
// Regra do WCAG 2.1: 4,5:1 para texto normal e 3:1 para texto grande (a partir de
// 24 px, ou 18,66 px em negrito). Fonte da fórmula de luminância relativa e da razão:
// w3.org/TR/WCAG21/#dfn-relative-luminance e #dfn-contrast-ratio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSONAGENS } from '../../src/characters.js';

const canal = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function luminancia(hex) {
  const n = hex.replace('#', '');
  const v = n.length === 3 ? [...n].map((c) => c + c) : n.match(/../g);
  const [r, g, b] = v.map((x) => canal(parseInt(x, 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const la = luminancia(a), lb = luminancia(b);
  return +(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05))).toFixed(2);
}

test('fórmula do contraste bate com os casos conhecidos do WCAG', () => {
  assert.equal(contraste('#000000', '#ffffff'), 21);
  assert.equal(contraste('#ffffff', '#ffffff'), 1);
});

// Cada par é [frente, fundo, mínimo, onde aparece].
function paresDe(p) {
  const c = p.paleta;
  return [
    [c.tinta, c.fundo1, 4.5, 'texto sobre o fundo claro do palco'],
    [c.tinta, c.fundo2, 4.5, 'texto sobre o fundo do gradiente'],
    [c.tinta, c.cartao, 4.5, 'texto no cartão, no quadro e nas legendas'],
    [c.tintaSuave, c.fundo1, 4.5, 'texto secundário sobre o fundo'],
    [c.tintaSuave, c.fundo2, 4.5, 'texto secundário na ponta clara do gradiente, o pior caso'],
    [c.tintaSuave, c.cartao, 4.5, 'o que a pessoa disse, e o rótulo do quadro'],
    [c.realceTinta, c.realce, 4.5, 'texto do botão Enviar'],
    [c.acaoTinta, c.acao, 4.5, 'ícone do microfone e texto do botão principal'],
    // O anel de foco tem outline-offset: ele fica fora do botão, sobre o fundo da tela.
    [c.tinta, c.fundo1, 3, 'anel de foco'],
    [c.tinta, c.fundo2, 3, 'anel de foco sobre a outra ponta do gradiente'],
  ];
}

for (const p of PERSONAGENS) {
  test(`contraste da paleta de ${p.nome}`, () => {
    const ruins = [];
    for (const [frente, fundo, minimo, onde] of paresDe(p)) {
      const r = contraste(frente, fundo);
      if (r < minimo) ruins.push(`${onde}: ${frente} sobre ${fundo} dá ${r}:1, precisa de ${minimo}:1`);
    }
    assert.deepEqual(ruins, [], `\n${ruins.join('\n')}`);
  });
}

test('a paleta padrão do CSS é a da primeira personagem', async () => {
  // Se divergirem, a tela pisca com outra cor até o ui.js aplicar a paleta. Compara com o :root do index.html, não com valores fixos.
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const raiz = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const v = (nome) => (raiz.match(new RegExp(String.raw`--${nome}:\s*(#[0-9a-fA-F]{3,6})`)) || [])[1];
  const c = PERSONAGENS[0].paleta;
  assert.equal(v('fundo-1'), c.fundo1);
  assert.equal(v('fundo-2'), c.fundo2);
  assert.equal(v('tinta'), c.tinta);
  assert.equal(v('acao'), c.acao);
  assert.equal(v('cartao'), c.cartao);
});
