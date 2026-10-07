// U6: política de sessão (limite de perguntas e de tempo) e filtro dos itens guiados aprovados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPoliticaSessao, itensAprovados } from '../../src/evento.js';

test('sem limites configurados, nunca encerra', () => {
  const p = criarPoliticaSessao({ agora: () => 0 });
  p.iniciar(); for (let i = 0; i < 50; i++) p.contarTurno();
  assert.equal(p.estado().motivo, null);
});

test('limite de perguntas: encerra no turno exato e informa o que falta', () => {
  const p = criarPoliticaSessao({ maxTurnos: 3, agora: () => 0 });
  p.iniciar();
  p.contarTurno(); p.contarTurno();
  assert.equal(p.estado().motivo, null);
  assert.equal(p.estado().turnosRestantes, 1);
  p.contarTurno();
  assert.equal(p.estado().motivo, 'turnos');
});

test('limite de tempo: conta a partir do início e encerra no instante exato', () => {
  let t = 1000;
  const p = criarPoliticaSessao({ maxSegundos: 60, agora: () => t });
  p.iniciar();
  t += 59_000; assert.equal(p.estado().motivo, null); assert.equal(p.estado().segundosRestantes, 1);
  t += 1_000; assert.equal(p.estado().motivo, 'tempo');
});

test('o tempo só começa no primeiro turno se não houve início explícito, e parar zera tudo', () => {
  let t = 0;
  const p = criarPoliticaSessao({ maxSegundos: 10, agora: () => t });
  t = 100_000; assert.equal(p.estado().motivo, null, 'sem início, nada corre');
  p.contarTurno(); t += 11_000; assert.equal(p.estado().motivo, 'tempo');
  p.parar(); assert.equal(p.estado().motivo, null); assert.equal(p.estado().turnos, 0);
});

test('configurar muda os limites sem perder a sessão em curso', () => {
  const p = criarPoliticaSessao({ agora: () => 0 });
  p.iniciar(); p.contarTurno(); p.contarTurno();
  p.configurar(2, 0);
  assert.equal(p.estado().motivo, 'turnos');
  p.configurar('x', -5); // valor inválido vira sem limite
  assert.equal(p.estado().motivo, null);
});

test('só entram os itens guiados aprovados e completos', () => {
  const lista = [
    { pergunta: 'a?', resposta: 'a', aprovado: true },
    { pergunta: 'b?', resposta: 'b', aprovado: false },
    { pergunta: 'c?', resposta: '' },
    { pergunta: 'd?', resposta: 'd' },
    null,
  ];
  assert.deepEqual(itensAprovados(lista).map((i) => i.pergunta), ['a?', 'd?']);
  assert.deepEqual(itensAprovados(undefined), []);
});
