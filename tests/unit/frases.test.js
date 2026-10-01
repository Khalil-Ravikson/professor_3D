import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarDivisor, dividirFrases, limparParaFala } from '../../src/tts/frases.js';

test('divide em pontos seguidos de espaço', () => {
  assert.deepEqual(dividirFrases('O céu é azul. A luz se espalha! Entendeu?'),
    ['O céu é azul.', 'A luz se espalha!', 'Entendeu?']);
});

test('não corta números decimais nem milhares', () => {
  assert.deepEqual(dividirFrases('O resultado é 3.5 metros. Depois 1.000 reais.'),
    ['O resultado é 3.5 metros.', 'Depois 1.000 reais.']);
  assert.deepEqual(dividirFrases('Deu 3,5 litros. Certo.'), ['Deu 3,5 litros.', 'Certo.']);
});

test('não corta abreviações nem iniciais', () => {
  assert.deepEqual(dividirFrases('O Sr. Silva e a Dra. Ana chegaram. J. Souza também.'),
    ['O Sr. Silva e a Dra. Ana chegaram.', 'J. Souza também.']);
  assert.deepEqual(dividirFrases('Use aprox. 2 kg de areia. Pronto.'),
    ['Use aprox. 2 kg de areia.', 'Pronto.']);
});

test('numeração de lista não vira frase sozinha', () => {
  assert.deepEqual(dividirFrases('1. Some os lados.\n2. Divida por dois.'),
    ['1. Some os lados.', '2. Divida por dois.']);
});

test('reticências, interrobang e aspas de fechamento', () => {
  assert.deepEqual(dividirFrases('Hmm... vamos ver?! Ela disse "pronto." E foi.'),
    ['Hmm...', 'vamos ver?!', 'Ela disse "pronto."', 'E foi.']);
});

test('quebra de linha encerra frase', () => {
  assert.deepEqual(dividirFrases('Passo um\nPasso dois'), ['Passo um', 'Passo dois']);
});

test('frase longa sem ponto é cortada na vírgula, não entre dígitos', () => {
  const longa = 'Primeiro a gente mede a largura do terreno com a trena, depois mede o comprimento com cuidado, ' +
    'anota tudo no caderno e só então multiplica os dois valores para achar a área total que vamos precisar cobrir';
  const frases = dividirFrases(longa, { maximo: 120 });
  assert.ok(frases.length >= 2, 'deveria cortar');
  for (const f of frases) assert.ok(f.length <= 120, `frase grande demais: ${f.length}`);
  assert.equal(frases.join(' '), longa);
  const comDecimal = dividirFrases('a'.repeat(50) + ' valor 3, 5 e mais ' + 'b'.repeat(80), { maximo: 100 });
  assert.ok(!comDecimal.some((f) => f.endsWith('3,')), 'não pode cortar em "3, 5"');
});

test('streaming: mesmo resultado com pedaços de qualquer tamanho', () => {
  const texto = 'O Sr. Teo mediu 3.5 m. A área deu 12,25 m². Confere? Sim! Fim.';
  const esperado = dividirFrases(texto);
  for (const tam of [1, 2, 3, 5, 7, 13]) {
    const d = criarDivisor();
    const saida = [];
    for (let i = 0; i < texto.length; i += tam) saida.push(...d.adicionar(texto.slice(i, i + tam)));
    saida.push(...d.finalizar());
    assert.deepEqual(saida, esperado, `pedaços de ${tam}`);
  }
});

test('streaming: "3." no fim do pedaço espera o próximo', () => {
  const d = criarDivisor();
  assert.deepEqual(d.adicionar('Mede 3.'), []);
  assert.deepEqual(d.adicionar('5 metros. Ok'), ['Mede 3.5 metros.']);
  assert.deepEqual(d.finalizar(), ['Ok']);
});

test('texto vazio ou só espaços', () => {
  assert.deepEqual(dividirFrases(''), []);
  assert.deepEqual(dividirFrases('   \n  '), []);
});

test('limparParaFala tira emoji, markdown e marcador de lista', () => {
  assert.equal(limparParaFala('**Oi** 😀 tudo _bem_?'), 'Oi  tudo bem?');
  assert.equal(limparParaFala('- item um\n• item dois'), 'item um\nitem dois');
});
