// Economia de tokens (08/10/2026): cache de respostas, resposta pronta direta da base e chunker v2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCacheRespostas, chaveDaPergunta, resumo, TTL_MS } from '../../src/cache-respostas.js';
import { perguntaDoTrecho, mesmaPergunta } from '../../src/rag/busca.js';
import { dividirEmTrechos, lerDocumento, VERSAO_CHUNKER } from '../../src/rag/chunker.js';

function memoria(inicial = {}) { let v = inicial; return { ler: () => v, gravar: (x) => { v = x; return true; }, get v() { return v; } }; }

test('cache: guarda, devolve e expira pelo TTL', () => {
  const m = memoria(); let t = 1000;
  const c = criarCacheRespostas({ ler: m.ler, gravar: m.gravar, agora: () => t });
  assert.equal(c.obter('a'), null);
  c.guardar('a', 'Olá!', [{ conta: '2+2', resultado: 4 }]);
  assert.deepEqual(c.obter('a'), { texto: 'Olá!', contas: [{ conta: '2+2', resultado: 4 }] });
  t += TTL_MS + 1;
  assert.equal(c.obter('a'), null, 'passou do TTL');
});

test('cache: não guarda texto vazio e o limite tira a entrada mais antiga', () => {
  const m = memoria(); let t = 1;
  const c = criarCacheRespostas({ ler: m.ler, gravar: m.gravar, agora: () => t++, maximo: 3 });
  assert.equal(c.guardar('x', '   '), false);
  for (const k of ['a', 'b', 'c', 'd']) c.guardar(k, 'texto ' + k);
  assert.equal(c.tamanho, 3);
  assert.equal(c.obter('a'), null, 'a mais antiga saiu');
  assert.ok(c.obter('d'));
});

test('cache: valor corrompido no armazenamento não derruba nada', () => {
  const c = criarCacheRespostas({ ler: () => 'lixo', gravar: () => true });
  assert.equal(c.obter('a'), null);
  assert.equal(c.tamanho, 0);
});

test('chave: muda com persona, modelo, trechos e pergunta; ignora acento, caixa e pontuação', () => {
  const base = { quemId: 'luma', persona: 'P1', modelo: 'm1', pergunta: 'O que é a UEMA?', trechos: [{ id: 'd#1' }] };
  const k = chaveDaPergunta(base);
  assert.equal(chaveDaPergunta({ ...base, pergunta: ' o QUE e a uema ' }), k);
  assert.notEqual(chaveDaPergunta({ ...base, persona: 'P2' }), k);
  assert.notEqual(chaveDaPergunta({ ...base, modelo: 'm2' }), k);
  assert.notEqual(chaveDaPergunta({ ...base, trechos: [{ id: 'd#2' }] }), k);
  assert.notEqual(chaveDaPergunta({ ...base, quemId: 'teo' }), k);
  assert.equal(resumo('abc'), resumo('abc'));
  assert.notEqual(resumo('abc'), resumo('abd'));
});

test('pergunta do trecho e comparação de perguntas', () => {
  assert.equal(perguntaDoTrecho('Pergunta: O que é a UEMA? Resposta-base: A UEMA é...'), 'O que é a UEMA?');
  assert.equal(perguntaDoTrecho('Texto comum sem pergunta.'), null);
  assert.ok(mesmaPergunta('O que é a UEMA?', 'o que e a uema'));
  assert.ok(mesmaPergunta('Para que serve o SigUema?', 'Para que serve o SigUema'));
  assert.ok(!mesmaPergunta('Como o CTIC conecta a internet?', 'O que significa o CTIC?'), 'outra pergunta do mesmo assunto');
  assert.ok(!mesmaPergunta('', 'O que é a UEMA?'));
});

const DOC = `fonte: teste
licenca: teste

# Documento

## 1. Primeira
Pergunta: O que é isso?
Resposta-base: É uma coisa simples. Serve para testar.

## 2. Segunda
Pergunta: Para que serve?
Resposta-base: Serve para provar que o título seguinte não vaza.

## 3. Terceira
Um parágrafo curto que sozinho é pequeno.

## 4. Quarta
Outro parágrafo curto, também pequeno.
`;

test('chunker v2: pergunta e resposta ficam num trecho só e nenhum texto carrega título', () => {
  assert.equal(VERSAO_CHUNKER, 2);
  const tr = dividirEmTrechos(lerDocumento(DOC), 'd.md');
  const faq = tr.filter((t) => t.pergunta);
  assert.equal(faq.length, 2);
  assert.equal(faq[0].resposta, 'É uma coisa simples. Serve para testar.');
  for (const t of tr) assert.ok(!/(^|\s)#{1,6}\s/.test(t.texto) && !/\d\.\s+[A-Z][a-z]+$/.test(t.texto.split('Resposta-base:')[0] || ''), `sem título no texto: ${t.texto}`);
  assert.ok(!tr[0].texto.includes('Segunda'), 'o título da próxima seção não vai para o fim do trecho anterior');
  assert.ok(!tr[1].texto.includes('Terceira'));
});

test('chunker v2: seções curtas seguidas se juntam e o corte é em fim de frase', () => {
  const tr = dividirEmTrechos(lerDocumento(DOC), 'd.md');
  const juntas = tr.find((t) => /Terceira/.test(t.secao) && /Quarta/.test(t.secao));
  assert.ok(juntas, 'as duas seções curtas viraram um trecho');
  const longa = Array.from({ length: 40 }, (_, i) => `Esta é a frase número ${i + 1} do texto longo, com algumas palavras para encher.`).join(' ');
  const t2 = dividirEmTrechos(lerDocumento(`fonte: t\nlicenca: t\n\n# D\n\n${longa}\n`), 'l.md');
  assert.ok(t2.length > 1);
  for (const t of t2) assert.match(t.texto, /[.!?]$/, `termina em fim de frase: ...${t.texto.slice(-30)}`);
});
