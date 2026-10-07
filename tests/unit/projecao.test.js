// Projeção de gasto: bate com a conta do REPERTORIO 23 e não inventa preço.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projetar, mediaPorResposta, respostasQueCabem, usdTexto, usdVoz, PREMISSA } from '../../src/projecao.js';

const reais = (r, modelo) => r.find((l) => l.modelo === modelo).reaisTotal;

test('premissa do REPERTORIO 23: 5.000 respostas dão R$ 124, 21, 28 e 7 (arredondado)', () => {
  const r = projetar({ respostas: 5000, cambio: 5.17 });
  assert.equal(Math.round(reais(r, 'gemini-3.5-flash')), 124);
  assert.equal(Math.round(reais(r, 'gemini-3.1-flash-lite')), 21);
  assert.equal(Math.round(reais(r, 'gemini-2.5-flash')), 28);
  assert.equal(Math.round(reais(r, 'gemini-2.5-flash-lite')), 7);
});

test('média medida vem do medidor; sem respostas cai na premissa e avisa', () => {
  assert.equal(mediaPorResposta({ respostas: 0 }).medido, false);
  const m = mediaPorResposta({ respostas: 4, entrada: 8000, saida: 400, pensamento: 200 });
  assert.deepEqual([m.entrada, m.saida, m.pensamento, m.medido, m.amostras], [2000, 100, 50, true, 4]);
});

test('pensamento custa como saída', () => {
  assert.equal(usdTexto('gemini-2.5-flash', { entrada: 0, saida: 100, pensamento: 900 }), 0.0025);
});

test('modelo desconhecido: sem preço, nada de chute', () => {
  assert.equal(usdTexto('gemini-9.9-turbo', PREMISSA), null);
  assert.equal(respostasQueCabem(200, { modelo: 'gemini-9.9-turbo' }), null);
  assert.equal(usdVoz('modelo-que-nao-existe', { caracteres: 300 }), null);
});

test('voz: 300 caracteres a 15 por segundo são 20 s, ou 500 tokens de saída', () => {
  // 3.8 Flash TTS em 2026: entrada 0,5 e saída 9,0 por milhão. Entrada estimada: 75 tokens.
  const v = usdVoz('gemini-3.8-flash-tts', { caracteres: 300, data: new Date('2026-10-07') });
  assert.ok(Math.abs(v - (75 / 1e6 * 0.5 + 500 / 1e6 * 9.0)) < 1e-12);
  // Em 2027 o preço de saída dobra.
  const v27 = usdVoz('gemini-3.8-flash-tts', { caracteres: 300, data: new Date('2027-01-02') });
  assert.ok(v27 > v);
});

test('quantas respostas cabem num teto', () => {
  assert.equal(respostasQueCabem(200, { modelo: 'gemini-3.5-flash', cambio: 5.17 }), 8059);
});

test('Cloud TTS por caractere: franquia mensal descontada, tipo desconhecido sem preço', async () => {
  const { usdCloudTts } = await import('../../src/projecao.js');
  assert.equal(usdCloudTts('wavenet', 1_500_000), 0, '1,5 mi cabe nos 4 mi grátis');
  assert.equal(usdCloudTts('neural2', 1_500_000), 8, '0,5 mi acima da franquia a US$ 16 por milhão');
  assert.equal(usdCloudTts('chirp3-hd', 1_500_000), 15);
  assert.equal(usdCloudTts('inventada', 10), null);
});
