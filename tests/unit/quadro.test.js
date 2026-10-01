import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcular } from '../../src/calcular.js';
import { criarLeitorMarcado, separarFalaEQuadro, extrairNumeros, criarPermitidos, conferirLinha, rotuloDaLinha } from '../../src/board.js';
import { normalizarParaFala } from '../../src/tts/frases.js';

/* ---------- calcular ---------- */

test('calcular: aritmética, precedência, porcentagem, frações e unidades', () => {
  assert.equal(calcular('3*7').valor, 21);
  assert.equal(calcular('(25 - 7) / 3').valor, 6);
  assert.equal(calcular('240 * (1 - 15%)').valor, 204);
  assert.equal(calcular('fraction(2,3) + fraction(3,4)').resultado, '17/12');
  assert.equal(calcular('12 m * 30 m').resultado, '360 m^2');
  assert.equal(calcular('0.1 + 0.2').resultado, '0.3');
  assert.equal(calcular('2 × 3 ÷ 4').valor, 1.5);
});

test('calcular: aceita vírgula decimal sem estragar argumentos de função', () => {
  assert.equal(calcular('3,5 * 2').valor, 7);
  assert.equal(calcular('fraction(1,4)').resultado, '1/4');
});

test('calcular: bloqueia funções perigosas e entradas inválidas', () => {
  for (const ruim of ['import({})', 'evaluate("1+1")', 'parse("1")', 'createUnit("x")', 'simplify("x+x")']) {
    assert.ok(calcular(ruim).erro, `deveria bloquear ${ruim}`);
  }
  assert.ok(calcular('').erro);
  assert.ok(calcular('1+').erro);
  assert.ok(calcular('1/0').erro, 'infinito não é resultado');
  assert.ok(calcular('9'.repeat(250)).erro, 'expressão gigante');
  assert.ok(calcular('f(x) = x^2').erro, 'definição de função não é conta');
});

/* ---------- leitor FALA / QUADRO ---------- */

const RESPOSTA = [
  'FALA: Vamos achar o x.',
  'QUADRO: Dado: 3x + 7 = 25',
  'QUADRO: Passo 1: 3x = 25 - 7 = 18',
  'FALA: Agora divido por três.',
  'QUADRO: Resposta: x = 6',
].join('\n');

test('separa fala e quadro', () => {
  const r = separarFalaEQuadro(RESPOSTA);
  assert.equal(r.fala, 'Vamos achar o x.\nAgora divido por três.');
  assert.deepEqual(r.quadro, ['Dado: 3x + 7 = 25', 'Passo 1: 3x = 25 - 7 = 18', 'Resposta: x = 6']);
  assert.equal(r.semMarcador, 0);
});

test('streaming: mesmo resultado com pedaços de qualquer tamanho', () => {
  for (const tam of [1, 2, 3, 7, 50]) {
    let fala = '';
    const quadro = [];
    const l = criarLeitorMarcado({ aoFala: (t) => { fala += t; }, aoQuadro: (q) => quadro.push(q) });
    for (let i = 0; i < RESPOSTA.length; i += tam) l.adicionar(RESPOSTA.slice(i, i + tam));
    l.finalizar();
    assert.equal(fala.replace(/\n+/g, '\n').trim(), 'Vamos achar o x.\nAgora divido por três.', `pedaços de ${tam}`);
    assert.equal(quadro.length, 3, `pedaços de ${tam}`);
  }
});

test('streaming: a fala sai antes da linha terminar', () => {
  let fala = '';
  const l = criarLeitorMarcado({ aoFala: (t) => { fala += t; }, aoQuadro: () => {} });
  l.adicionar('FALA: Primeiro a gente');
  assert.equal(fala, 'Primeiro a gente');
});

test('marcadores com enfeite de markdown, minúsculas e colchetes', () => {
  const r = separarFalaEQuadro('**FALA:** oi\n- quadro: Passo 1: x\n[QUADRO]: Resposta: 2\n  Fala:tchau');
  assert.equal(r.fala, 'oi\ntchau');
  assert.deepEqual(r.quadro, ['Passo 1: x', 'Resposta: 2']);
});

test('resposta malformada: sem marcador vira fala, nada se perde', () => {
  const r = separarFalaEQuadro('O resultado é 6.\nQUADRO: Resposta: 6\nFalando nisso, confere.');
  assert.equal(r.fala, 'O resultado é 6.\nFalando nisso, confere.');
  assert.deepEqual(r.quadro, ['Resposta: 6']);
  assert.equal(r.semMarcador, 2);
  assert.equal(separarFalaEQuadro('').fala, '');
  assert.equal(separarFalaEQuadro('Quadrado tem 4 lados.').fala, 'Quadrado tem 4 lados.');
});

/* ---------- conferência de números ---------- */

test('extrairNumeros: decimais pt/en, milhar, ignora rótulo, ordinal e expoente', () => {
  const v = (t) => extrairNumeros(t).map((n) => n.valores);
  assert.deepEqual(v('3,5 e 3.5'), [[3.5], [3.5]]);
  assert.deepEqual(v('1.000 reais'), [[1, 1000]], 'ambíguo: vale 1 (en) ou 1000 (pt)');
  assert.deepEqual(v('Passo 2: 1º lugar, x2 e 4 m²'), [[4]]);
});

test('conferirLinha: número do enunciado ou da calculadora passa; inventado é marcado', () => {
  const contas = [calcular('25 - 7'), calcular('18 / 3')];
  const permitidos = criarPermitidos('Resolva 3x + 7 = 25', contas);
  assert.equal(conferirLinha('3x = 25 - 7 = 18', permitidos).suspeitos, 0);
  assert.equal(conferirLinha('x = 6', permitidos).suspeitos, 0);
  const ruim = conferirLinha('x = 8', permitidos);
  assert.equal(ruim.suspeitos, 1);
  assert.deepEqual(ruim.pedacos.find((p) => !p.conferido), { texto: '8', conferido: false, numero: true });
});

test('conferirLinha: arredondamento e porcentagem', () => {
  const permitidos = criarPermitidos('Divida 2 por 3', [calcular('2/3'), calcular('1 - 15%')]);
  assert.equal(conferirLinha('fica 0,67', permitidos).suspeitos, 0, '0,67 arredonda 0,666...');
  assert.equal(conferirLinha('fica 0,6', permitidos).suspeitos, 1, '0,6 não é arredondamento de 0,666...');
  assert.equal(conferirLinha('paga 85%', permitidos).suspeitos, 0, '85% = 0,85');
});

test('rotuloDaLinha', () => {
  assert.deepEqual(rotuloDaLinha('Passo 1: some'), { rotulo: 'Passo 1', corpo: 'some' });
  assert.deepEqual(rotuloDaLinha('x = 6'), { rotulo: '', corpo: 'x = 6' });
});

/* ---------- símbolos para a fala ---------- */

test('normalizarParaFala: símbolos e unidades em palavras', () => {
  assert.equal(normalizarParaFala('Desconto de 15%'), 'Desconto de 15 por cento');
  assert.equal(normalizarParaFala('Área de 360 m²'), 'Área de 360 metros quadrados');
  assert.equal(normalizarParaFala('3 × 7 = 21'), '3 vezes 7 é igual a 21');
  assert.equal(normalizarParaFala('25 - 7 = 18'), '25 menos 7 é igual a 18');
  assert.equal(normalizarParaFala('de 5-10 minutos'), 'de 5-10 minutos', 'intervalo não vira conta');
  assert.equal(normalizarParaFala('custa R$ 240'), 'custa 240 reais');
});
