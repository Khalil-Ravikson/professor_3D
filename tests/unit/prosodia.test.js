// Prosódia por frase (08/10/2026): tom e ritmo por emoção e pontuação, pausa depois da frase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prosodia, vozComProsodia, pausaAposFrase } from '../../src/tts/prosodia.js';

test('prosódia: pergunta sobe o tom, exclamação acelera, reticências desaceleram', () => {
  const neutra = prosodia('Hoje está calor em São Luís.', 'neutro');
  assert.deepEqual(neutra, { rate: 1, pitch: 1 });
  assert.ok(prosodia('Você sabia disso, meu amigo?', 'neutro').pitch > neutra.pitch);
  assert.ok(prosodia('Que legal ver você aqui hoje!', 'neutro').rate > neutra.rate);
  assert.ok(prosodia('Bom... deixa eu pensar um pouco...', 'neutro').rate < neutra.rate);
});

test('prosódia: emoção muda o ritmo e o tom, sem exagero', () => {
  const alegre = prosodia('Vamos aprender juntos hoje.', 'alegre'), triste = prosodia('Vamos aprender juntos hoje.', 'empatico');
  assert.ok(alegre.rate > 1 && alegre.pitch > 1);
  assert.ok(triste.rate < 1 && triste.pitch < 1);
  for (const e of ['neutro', 'alegre', 'pensativo', 'surpreso', 'curioso', 'empatico', 'inexistente']) {
    const p = prosodia('Uma frase qualquer para medir o limite máximo permitido?', e);
    assert.ok(p.rate >= 0.8 && p.rate <= 1.25 && p.pitch >= 0.85 && p.pitch <= 1.2, `${e}: ${JSON.stringify(p)}`);
  }
});

test('voz com prosódia: multiplica a velocidade do personagem e não altera o original', () => {
  const voz = { motor: 'kokoro-server', id: 'pf_dora', speed: 1.05 };
  const v = vozComProsodia(voz, 'Você quer saber mais?', 'curioso');
  assert.ok(v.speed > 0.5 && v.speed < 2 && v.pitch > 1);
  assert.equal(voz.speed, 1.05, 'o objeto da voz do personagem não muda');
  assert.equal(vozComProsodia(voz, 'Oi!', 'alegre', false), voz, 'desligada: devolve a mesma voz');
  assert.equal(vozComProsodia(null, 'Oi!', 'alegre'), null);
});

test('pausa depois da frase: pergunta e reticências respiram mais, exclamação e alegria menos, nunca abaixo de 60 ms', () => {
  const base = 250;
  assert.equal(pausaAposFrase('Uma frase comum.', 'neutro', base), base);
  assert.ok(pausaAposFrase('Você entendeu?', 'neutro', base) > base);
  assert.ok(pausaAposFrase('Deixa eu ver...', 'neutro', base) > pausaAposFrase('Você entendeu?', 'neutro', base));
  assert.ok(pausaAposFrase('Muito bem!', 'alegre', base) < base);
  assert.ok(pausaAposFrase('Hmm.', 'pensativo', base) > base);
  assert.equal(pausaAposFrase('Muito bem!', 'alegre', 10), 60);
});
