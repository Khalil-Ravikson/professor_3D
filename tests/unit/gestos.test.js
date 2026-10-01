import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarDiretor, extrairGestos, removerMarcas, instrucaoGestos } from '../../src/gestos.js';

const CLIPES = [
  { id: 'idle', status: 'ativo', intensidade: 1, infantilOk: true },
  { id: 'aceno', status: 'ativo', intensidade: 1, infantilOk: true },
  { id: 'sinal-paz', status: 'ativo', intensidade: 2, infantilOk: true },
  { id: 'giro', status: 'ativo', intensidade: 3, infantilOk: true },
  { id: 'dedo-arma', status: 'ativo', intensidade: 2, infantilOk: false },
  { id: 'agachar', status: 'desligado', intensidade: 3, infantilOk: true },
];
const MAPA = { idle: 'idle', talking: null, thinking: null, aceno: 'aceno', despedida: 'aceno', comemora: ['sinal-paz', 'giro'], atira: 'dedo-arma', agacha: 'agachar', 'nao-sei': null };

function diretor(extra = {}) {
  let t = 100;
  const log = [];
  const d = criarDiretor({ clipes: CLIPES, mapa: MAPA, agora: () => t, registrar: (m) => log.push(m), ...extra });
  return { d, log, avancar: (s) => { t += s; } };
}

test('estado sem clipe cai para o idle', () => {
  const { d } = diretor();
  assert.equal(d.clipeBase('talking').id, 'idle');
  assert.equal(d.clipeBase('idle').id, 'idle');
});

test('pedido inválido do LLM é ignorado e registrado', () => {
  const { d, log } = diretor();
  assert.deepEqual(d.pedir('dancar-funk', { origem: 'llm' }), { ignorado: 'inexistente' });
  assert.deepEqual(d.pedir('talking', { origem: 'llm' }), { ignorado: 'estado' });
  assert.deepEqual(d.pedir('nao-sei', { origem: 'llm' }), { ignorado: 'sem-clipe' });
  assert.deepEqual(d.pedir('agacha', { origem: 'llm' }), { ignorado: 'sem-clipe' }); // desligado na galeria
  assert.equal(log.length, 4);
  assert.match(log[0], /dancar-funk/);
});

test('gesto pedido durante a fala espera a fronteira da sentença', () => {
  const { d } = diretor();
  assert.deepEqual(d.pedir('comemora', { origem: 'llm', falando: true }), { esperando: true });
  assert.equal(d.pendente, 'comemora');
  const c = d.fronteira();
  assert.equal(c.id, 'sinal-paz');
  assert.equal(d.fronteira(), null);
});

test('não repete o mesmo gesto e respeita o intervalo mínimo', () => {
  const { d, avancar } = diretor({ intervaloMinS: 8 });
  assert.ok(d.pedir('comemora').clipe);
  assert.deepEqual(d.pedir('aceno'), { ignorado: 'ocupado' });
  avancar(20); d.terminou();
  assert.deepEqual(d.pedir('aceno'), { ignorado: 'intervalo' }); // conta do fim do gesto, não do início
  avancar(9);
  assert.deepEqual(d.pedir('comemora'), { ignorado: 'repetido' });
  assert.ok(d.pedir('aceno').clipe);
  d.terminou(); avancar(2);
  assert.deepEqual(d.pedir('comemora'), { ignorado: 'intervalo' });
  avancar(10);
  assert.equal(d.pedir('comemora').clipe.id, 'giro'); // alterna entre as opções
});

test('fluxo (cumprimento) passa por cima do intervalo e da repetição', () => {
  const { d } = diretor();
  assert.ok(d.pedir('aceno', { origem: 'fluxo' }).clipe);
  assert.ok(d.pedir('aceno', { origem: 'fluxo' }).clipe);
});

test('modo infantil esconde clipe não ok para criança; modo calmo só intensidade 1', () => {
  const inf = diretor({ infantil: () => true });
  assert.deepEqual(inf.d.pedir('atira'), { ignorado: 'sem-clipe' });
  const calmo = diretor({ calmo: () => true });
  assert.deepEqual(calmo.d.pedir('comemora'), { ignorado: 'sem-clipe' });
  assert.ok(calmo.d.pedir('aceno').clipe);
  assert.deepEqual(calmo.d.gestosValidos(), ['aceno', 'despedida']);
});

test('inventário do personagem limita os gestos', () => {
  const { d } = diretor({ inventario: ['aceno'] });
  assert.deepEqual(d.pedir('comemora', { origem: 'llm' }), { ignorado: 'inventario' });
  assert.deepEqual(d.gestosValidos(), ['aceno']);
});

test('extrai marcas da sentença e devolve o texto limpo', () => {
  assert.deepEqual(extrairGestos('[gesto:comemora] Muito bem!'), { texto: 'Muito bem!', gestos: ['comemora'] });
  assert.deepEqual(extrairGestos('Sem marca. [x]'), { texto: 'Sem marca. [x]', gestos: [] });
});

test('remove marcas da tela, inclusive incompleta no fim', () => {
  assert.equal(removerMarcas('Oi. [gesto:aceno] Tchau. [ges'), 'Oi. Tchau. ');
  assert.equal(removerMarcas('Lista [1]'), 'Lista [1]');
});

test('instrução para o LLM só lista gestos válidos', () => {
  assert.equal(instrucaoGestos([]), '');
  assert.match(instrucaoGestos(['comemora']), /comemora/);
});
