import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { aplicarLexico, validarLexico } from '../../src/tts/lexico.js';
import { usdDoTexto, MODELOS_ELEVENLABS } from '../../src/tts/elevenlabs.js';
import { hashImportado } from '../../src/tts/importado.js';
import { FRASES_LAB, embaralhar, montarAmostras, resumirVoz, recomendar, gerarRelatorio, LIMIARES_PADRAO } from '../../src/tts/laboratorio.js';

test('léxico troca só palavra inteira e respeita o motor', () => {
  const lex = { entradas: [{ de: 'UEMA', para: 'Uema' }, { de: 'FESM', para: 'Fesm', motores: ['elevenlabs'] }] };
  assert.equal(aplicarLexico('A UEMA e a UEMASUL', 'kokoro-server', lex), 'A Uema e a UEMASUL');
  assert.equal(aplicarLexico('FESM', 'kokoro-server', lex), 'FESM');
  assert.equal(aplicarLexico('FESM', 'elevenlabs', lex), 'Fesm');
  assert.equal(aplicarLexico('Maranhão', 'x', { entradas: [{ de: 'Maranhão', para: 'Maranhaum' }] }), 'Maranhaum');
  assert.equal(aplicarLexico('texto', 'x', null), 'texto');
});
test('validarLexico recusa travessão e entrada incompleta', () => {
  assert.deepEqual(validarLexico({ entradas: [{ de: 'a', para: 'b' }] }), []);
  assert.equal(validarLexico({ entradas: [{ de: 'a', para: 'b — c' }] }).length, 1);
  assert.equal(validarLexico({}).length, 1);
});
test('custo do ElevenLabs: caracteres x preço por mil; modelo fora da tabela não tem preço', () => {
  assert.equal(usdDoTexto('a'.repeat(1000), 'eleven_flash_v2_5'), 0.04);
  assert.equal(usdDoTexto('a'.repeat(500), 'eleven_multilingual_v2'), 0.04);
  assert.equal(usdDoTexto('x', 'eleven_flash_v2'), null);
  assert.ok(!('eleven_flash_v2' in MODELOS_ELEVENLABS)); // só inglês
});
test('hash do áudio importado é o mesmo do script (sha256 de voz|texto normalizado)', async () => {
  const esperado = createHash('sha256').update('voz1|olá mundo').digest('hex');
  assert.equal(await hashImportado('voz1', '  olá   mundo '), esperado);
});
test('13 frases e nenhuma com travessão', () => {
  assert.equal(FRASES_LAB.length, 13);
  assert.ok(FRASES_LAB.every((f) => !f.texto.includes('—')));
});
test('amostras: uma por voz e frase, códigos únicos, ordem não segue a voz', () => {
  const vozes = [{ id: 'a' }, { id: 'b' }];
  let s = 1; const alea = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const am = montarAmostras(vozes, FRASES_LAB, alea);
  assert.equal(am.length, 26);
  assert.equal(new Set(am.map((x) => x.codigo)).size, 26);
  assert.notDeepEqual(am.slice(0, 13).map((x) => x.vozId), Array(13).fill('a'));
  assert.deepEqual(embaralhar([1, 2, 3], () => 0).sort(), [1, 2, 3]);
});
const med = (v, f, ms, dur, extra = {}) => ({ vozId: v, fraseId: f, ok: true, ms, msCabecalho: ms / 2, duracao: dur, caracteres: 100, usd: 0, ...extra });
const nota = (v, f, n, p) => ({ vozId: v, fraseId: f, naturalidade: n, clareza: n, ...(p ? { pronuncia: p } : {}) });
test('resumo e papel: ao vivo, pré-gravada, reserva, desligada', () => {
  const m = [];
  const n = [];
  for (const [v, ms, dur2] of [['boa', 1200, 2.0], ['lenta', 4000, 2.0], ['instavel', 1000, 3.0], ['media', 1000, 2.0], ['ruim', 1000, 2.0]]) {
    for (const f of FRASES_LAB) m.push(med(v, f.id, ms, 2.0));
    m.push(med(v, 'f01', ms, dur2, { repeticao: 2 }));
  }
  const dar = (v, x, p) => { for (const f of FRASES_LAB) n.push(nota(v, f.id, x, f.nomes ? p : undefined)); };
  dar('boa', 4, 4); dar('lenta', 4, 4); dar('instavel', 4, 4); dar('media', 3.2, 3.2); dar('ruim', 2, 2);
  const papel = (v) => recomendar(resumirVoz(v, m, n)).papel;
  assert.equal(papel('boa'), 'ao vivo');
  assert.equal(papel('lenta'), 'pré-gravada');
  assert.equal(papel('instavel'), 'pré-gravada');
  assert.equal(papel('media'), 'reserva');
  assert.equal(papel('ruim'), 'desligada');
  assert.equal(recomendar(resumirVoz('semnota', m, n)).papel, 'sem dados');
  assert.equal(resumirVoz('boa', m, n).estabilidadePct, 0);
  assert.equal(Math.round(resumirVoz('instavel', m, n).estabilidadePct), 50);
});
test('muitas falhas desligam a voz mesmo com nota alta; custo por mil caracteres', () => {
  const m = FRASES_LAB.map((f, i) => ({ vozId: 'x', fraseId: f.id, ok: i > 4, ms: 100, duracao: 1, caracteres: 1000, usd: 0.04 }));
  const n = FRASES_LAB.map((f) => nota('x', f.id, 5, 5));
  const r = resumirVoz('x', m, n);
  assert.equal(recomendar(r, LIMIARES_PADRAO).papel, 'desligada');
  assert.equal(r.usdPorMilCaracteres, 0.04);
});
test('relatório traz tabela, papel por voz e as regras', () => {
  const m = FRASES_LAB.map((f) => med('a', f.id, 800, 2));
  const n = FRASES_LAB.map((f) => nota('a', f.id, 5, 5));
  const md = gerarRelatorio({ vozes: [{ id: 'a', nome: 'Voz A', motor: 'kokoro-server' }], medicoes: m, notas: n, data: '2026-10-07' });
  assert.match(md, /Voz A/);
  assert.match(md, /ao vivo/);
  assert.match(md, /Regras usadas/);
  assert.ok(!md.includes('—'));
});
