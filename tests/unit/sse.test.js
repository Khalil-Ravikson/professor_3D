import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarLeitorSSE, textoDoEvento, configDePensamento, ErroGemini } from '../../src/brain.js';

const evento = (texto, extra = {}) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }], ...extra })}\r\n\r\n`;

test('SSE: junta eventos que chegam partidos em qualquer ponto', () => {
  const fluxo = evento('Olá, ') + evento('tudo bem?') + evento(' Sim.');
  for (const tam of [1, 3, 10, 50, fluxo.length]) {
    let texto = '';
    const l = criarLeitorSSE((ev) => { texto += textoDoEvento(ev); });
    for (let i = 0; i < fluxo.length; i += tam) l.adicionar(fluxo.slice(i, i + tam));
    l.finalizar();
    assert.equal(texto, 'Olá, tudo bem? Sim.', `pedaços de ${tam}`);
  }
});

test('SSE: último evento sem linha em branco final ainda é lido', () => {
  let n = 0;
  const l = criarLeitorSSE(() => n++);
  l.adicionar('data: {"candidates":[]}');
  l.finalizar();
  assert.equal(n, 1);
});

test('textoDoEvento ignora partes de pensamento e evento sem candidatos', () => {
  const ev = { candidates: [{ content: { parts: [{ text: 'rascunho', thought: true }, { text: 'resposta' }] } }] };
  assert.equal(textoDoEvento(ev), 'resposta');
  assert.equal(textoDoEvento({ candidates: [{ finishReason: 'SAFETY' }] }), '');
});

test('textoDoEvento lança ErroGemini quando o fluxo traz erro', () => {
  assert.throws(() => textoDoEvento({ error: { code: 429, message: 'quota' } }), ErroGemini);
});

test('configDePensamento: 2.5 usa budget 0, 3.x usa thinkingLevel minimal', () => {
  assert.deepEqual(configDePensamento('gemini-2.5-flash'), { thinkingBudget: 0 });
  assert.deepEqual(configDePensamento('gemini-3.5-flash'), { thinkingLevel: 'minimal' });
});
