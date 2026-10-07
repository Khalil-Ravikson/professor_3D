// R2: a marca de emoção nunca vai para o áudio, e marca inválida cai em neutro. Saídas malformadas incluídas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairEmocao, removerEmocao, normalizarEmocao, EMOCOES, EXPRESSOES } from '../../src/emocao.js';
import { extrairGestos } from '../../src/gestos.js';
import { limparParaFala, normalizarParaFala } from '../../src/tts/frases.js';

// O mesmo caminho da voz: gesto, emoção, limpeza e normalização. O que sobra é o que vai ao sintetizador.
const paraAudio = (t) => normalizarParaFala(limparParaFala(extrairEmocao(extrairGestos(t).texto).texto)).trim();

test('as seis emoções existem e cada uma tem expressões de peso baixo', () => {
  assert.deepEqual(EMOCOES, ['neutro', 'alegre', 'pensativo', 'surpreso', 'curioso', 'empatico']);
  for (const [nome, pesos] of Object.entries(EXPRESSOES)) for (const w of Object.values(pesos)) assert.ok(w > 0 && w <= 0.5, `${nome} passa de 0,5`);
});

test('marca válida vira emoção e some do texto', () => {
  assert.deepEqual(extrairEmocao('[emo:alegre] Que legal!'), { texto: 'Que legal!', emocao: 'alegre' });
  assert.equal(extrairEmocao('Oi. [emo:empático] Entendo.').emocao, 'empatico');
  assert.equal(extrairEmocao('[EMO:Surpreso]Uau').emocao, 'surpreso');
});

test('marca inválida cai em neutro; sem marca devolve null', () => {
  assert.equal(extrairEmocao('[emo:raiva] Hum.').emocao, 'neutro');
  assert.equal(extrairEmocao('[emo:] a').emocao, 'neutro');
  assert.equal(extrairEmocao('sem marca').emocao, null);
  assert.equal(normalizarEmocao(undefined), 'neutro');
});

test('saídas malformadas: nenhum resto de marca chega ao áudio e a fala não é engolida', () => {
  const entradas = [
    '[emo:alegre Que bom te ver.', '[emo: ] Oi.', '[emo:alegre][emo:triste] Duas marcas.', '[ emo : alegre ] Espaços.',
    'Meio [emo:curioso] da frase.', '[emo:alegre] [gesto:aceno] Juntas.', '[emo', 'Fim [emo:', '[emo:ale',
  ];
  for (const e of entradas) {
    const a = paraAudio(e);
    assert.doesNotMatch(a, /emo|\[|\]/i, `a marca vazou: "${e}" -> "${a}"`);
  }
  assert.equal(paraAudio('[emo:alegre Que bom te ver.'), 'Que bom te ver.');
});

test('texto mostrado na tela esconde a marca completa e a incompleta no fim do streaming', () => {
  assert.equal(removerEmocao('Olá [emo:alegre] tudo'), 'Olá tudo');
  assert.equal(removerEmocao('Olá [emo:ale'), 'Olá ');
  assert.equal(removerEmocao('Olá ['), 'Olá ');
});
