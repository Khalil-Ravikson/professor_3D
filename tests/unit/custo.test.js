// P9: medidor de gasto do Gemini. Os preços são os da tabela oficial lida em 06/10/2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMedidorDeCusto, chaveDoModelo, PRECOS_USD, CAMBIO_PADRAO } from '../../src/custo.js';

const uso = (entrada, saida, pensamento = 0) => ({
  promptTokenCount: entrada, candidatesTokenCount: saida, thoughtsTokenCount: pensamento,
});

test('chaveDoModelo: tira o prefixo models/ e casa variantes com sufixo', () => {
  assert.equal(chaveDoModelo('models/gemini-2.5-flash'), 'gemini-2.5-flash');
  assert.equal(chaveDoModelo('gemini-2.5-flash-lite'), 'gemini-2.5-flash-lite');
  // Sufixo de revisão casa com o prefixo mais longo, não com o mais curto.
  assert.equal(chaveDoModelo('gemini-2.5-flash-lite-001'), 'gemini-2.5-flash-lite');
  assert.equal(chaveDoModelo('gemini-9.9-turbo'), 'gemini-9.9-turbo', 'desconhecido volta como veio');
});

test('soma tokens e converte com o preço do modelo', () => {
  const m = criarMedidorDeCusto({ cambio: 5 });
  m.somar('gemini-2.5-flash', uso(2000, 200));
  const r = m.resumo();
  // 2000/1e6 * 0,30 + 200/1e6 * 2,50 = 0,0006 + 0,0005 = 0,0011 USD
  assert.equal(r.usd, 0.0011);
  assert.equal(r.reais, 0.01);
  assert.equal(r.respostas, 1);
  assert.equal(r.entrada, 2000);
  assert.deepEqual(r.semPreco, []);
});

test('tokens de pensamento são cobrados como saída', () => {
  const m = criarMedidorDeCusto({ cambio: 1 });
  m.somar('gemini-2.5-flash', uso(0, 100, 900));
  // 1000 tokens de saída a 2,50 por milhão
  assert.equal(m.resumo().usd, 0.0025);
});

test('modelo sem preço na tabela não inventa valor', () => {
  const m = criarMedidorDeCusto({ cambio: 5 });
  m.somar('gemini-9.9-turbo', uso(1000, 1000));
  const r = m.resumo();
  assert.equal(r.usd, 0);
  assert.deepEqual(r.semPreco, ['gemini-9.9-turbo']);
  assert.equal(r.entrada, 1000, 'os tokens continuam contados');
  assert.equal(m.precoDe('gemini-9.9-turbo'), null);
});

test('o operador pode digitar o preço de um modelo novo', () => {
  const m = criarMedidorDeCusto({ cambio: 5 });
  m.somar('gemini-9.9-turbo', uso(1_000_000, 0));
  m.definirPreco('gemini-9.9-turbo', 2, 10);
  const r = m.resumo();
  assert.equal(r.usd, 2);
  assert.equal(r.reais, 10);
  assert.deepEqual(r.semPreco, []);
});

test('câmbio muda o valor em reais, não o valor em dólares', () => {
  const m = criarMedidorDeCusto({ cambio: 5 });
  m.somar('gemini-2.5-flash-lite', uso(1_000_000, 1_000_000));
  assert.equal(m.resumo().usd, 0.5); // 0,10 + 0,40
  assert.equal(m.resumo().reais, 2.5);
  m.definirCambio(6);
  assert.equal(m.resumo().usd, 0.5);
  assert.equal(m.resumo().reais, 3);
});

test('sessão e dia contam separado; zerar a sessão não apaga o dia', () => {
  const m = criarMedidorDeCusto({ cambio: CAMBIO_PADRAO });
  m.somar('gemini-2.5-flash', uso(100, 10));
  m.somar('gemini-2.5-flash', uso(100, 10));
  assert.equal(m.resumo().respostas, 2);
  assert.equal(m.resumo().sessao.respostas, 2);
  m.zerarSessao();
  assert.equal(m.resumo().respostas, 2);
  assert.equal(m.resumo().sessao.respostas, 0);
});

test('estado de outro dia é descartado ao retomar', () => {
  const ontem = { dia: '2000-01-01', entrada: 999, saida: 999, pensamento: 0, respostas: 9, porModelo: { 'gemini-2.5-flash': { entrada: 999, saida: 999, pensamento: 0 } } };
  const m = criarMedidorDeCusto({ estadoInicial: ontem });
  m.somar('gemini-2.5-flash', uso(10, 10));
  const r = m.resumo();
  assert.equal(r.entrada, 10);
  assert.equal(r.respostas, 1);
});

test('uso ausente não quebra nem conta resposta', () => {
  const m = criarMedidorDeCusto({});
  m.somar('gemini-2.5-flash', null);
  assert.equal(m.resumo().respostas, 0);
});

test('a tabela de preços tem os modelos lidos da página oficial em 07/10/2026', () => {
  assert.deepEqual(Object.keys(PRECOS_USD).sort(), [
    'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash',
  ]);
  assert.deepEqual(PRECOS_USD['gemini-3.5-flash'], { entrada: 1.5, saida: 9 });
});

import { precoVigente, situacaoDoTeto } from '../../src/custo.js';

test('o 3.8 Flash dobra de preço em 01/01/2027', () => {
  assert.deepEqual(precoVigente(PRECOS_USD['gemini-3.8-flash'], new Date('2026-12-31')), { entrada: 0.75, saida: 3.75 });
  assert.deepEqual(precoVigente(PRECOS_USD['gemini-3.8-flash'], new Date('2027-01-01')), { entrada: 1.5, saida: 7.5 });
});

test('situação do teto: ok, aviso aos 80% e estourou', () => {
  assert.equal(situacaoDoTeto(10, 50).nivel, 'ok');
  assert.equal(situacaoDoTeto(40, 50).nivel, 'aviso');
  assert.equal(situacaoDoTeto(50, 50).nivel, 'estourou');
  assert.equal(situacaoDoTeto(10, 0).nivel, 'sem-teto');
});

test('o gasto acumulado atravessa a virada do dia e a voz paga entra no mesmo teto', () => {
  const ontem = { dia: '2000-01-01', entrada: 5, saida: 5, pensamento: 0, respostas: 1, porModelo: {}, acumUsd: 1 };
  const m = criarMedidorDeCusto({ estadoInicial: ontem, cambio: 5 });
  assert.equal(m.resumo().acumuladoUsd, 1, 'o dia virou, o acumulado ficou');
  m.somarExtra(0.5);
  m.somar('gemini-2.5-flash', { promptTokenCount: 1e6, candidatesTokenCount: 0 }); // US$ 0,30
  assert.equal(m.resumo().acumuladoUsd, 1.8);
  assert.equal(m.resumo().acumuladoReais, 9);
});
