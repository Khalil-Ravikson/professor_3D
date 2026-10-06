// P9: o vigia do laço de renderização. Precisa de document e sessionStorage,
// que aqui são de mentira, e de um relógio que anda quando o teste manda.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
};
const guardado = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, v),
  removeItem: (k) => guardado.delete(k),
};

const { criarVigia, contarRecargas, esquecerRecargas } = await import('../../src/vigia.js');

beforeEach(() => {
  guardado.clear();
  document.hidden = false;
});

function montar({ maxRecargas = 3 } = {}) {
  const eventos = [];
  let relogio = 100_000;   // começa longe de zero, como o performance.now de uma página viva
  let quadro = 100_000;
  const v = criarVigia({
    ultimoQuadro: () => quadro,
    limiteMs: 10_000,
    intervaloMs: 60_000,   // os testes chamam checarAgora; o intervalo real não entra
    maxRecargas,
    aoTravar: (i) => eventos.push(['travou', i.tentativa]),
    aoDesistir: (i) => eventos.push(['desistiu', i.tentativa]),
    recarregar: () => eventos.push(['recarregou']),
    agora: () => relogio,
  });
  v.iniciar();
  return {
    v, eventos,
    // Passa o tempo. Com `desenhando`, os quadros continuam saindo.
    avancar(ms, desenhando = false) { relogio += ms; if (desenhando) quadro = relogio; },
  };
}

test('vigia: laço andando não dispara nada', () => {
  const { v, eventos, avancar } = montar();
  for (let i = 0; i < 10; i++) { avancar(5_000, true); v.checarAgora(); }
  assert.deepEqual(eventos, []);
  assert.equal(contarRecargas(), 0);
  v.parar();
});

test('vigia: parada curta não dispara; passou do limite, recarrega', () => {
  const { v, eventos, avancar } = montar();
  avancar(9_000);          // parado há 9 s, limite é 10 s
  v.checarAgora();
  assert.deepEqual(eventos, []);
  avancar(2_000);          // agora 11 s
  v.checarAgora();         // a rodada anterior foi há 2 s, então esta vale
  assert.deepEqual(eventos, [['travou', 1], ['recarregou']]);
  assert.equal(contarRecargas(), 1, 'a tentativa fica guardada para a próxima carga');
  v.parar();
});

test('vigia: dispara uma vez só, mesmo que o laço siga parado', () => {
  const { v, eventos, avancar } = montar();
  // Duas rodadas de 6 s: a primeira ainda está dentro do limite, a segunda acusa.
  avancar(6_000); v.checarAgora();
  avancar(6_000); v.checarAgora();
  v.checarAgora();
  v.checarAgora();
  assert.equal(eventos.filter((e) => e[0] === 'recarregou').length, 1);
  assert.equal(v.armado, false);
  v.parar();
});

test('vigia: aba oculta não conta como travamento', () => {
  const { v, eventos, avancar } = montar();
  document.hidden = true;
  avancar(60_000);
  v.checarAgora();
  assert.deepEqual(eventos, []);
  // De volta à aba, o tempo parado não conta retroativamente: o vigia espera o limite
  // inteiro antes de acusar. Isso é o que impede recarga ao acordar a máquina.
  document.hidden = false;
  v.checarAgora();
  assert.deepEqual(eventos, [], 'a rodada que volta do segundo plano não acusa nada');
  // A partir daí o relógio vale de novo: duas rodadas curtas com o laço parado acusam.
  avancar(6_000); v.checarAgora();
  avancar(6_000); v.checarAgora();
  assert.deepEqual(eventos, [['travou', 1], ['recarregou']]);
  v.parar();
});

test('vigia: passado o limite de recargas, desiste em vez de recarregar de novo', () => {
  guardado.set('prof3d_recargas', '3');
  const { v, eventos, avancar } = montar({ maxRecargas: 3 });
  avancar(6_000); v.checarAgora();
  avancar(6_000); v.checarAgora();
  assert.deepEqual(eventos, [['desistiu', 4]]);
  assert.equal(contarRecargas(), 3, 'não conta a tentativa que não aconteceu');
  v.parar();
});

test('contarRecargas e esquecerRecargas leem e limpam o sessionStorage', () => {
  assert.equal(contarRecargas(), 0);
  guardado.set('prof3d_recargas', '2');
  assert.equal(contarRecargas(), 2);
  esquecerRecargas();
  assert.equal(contarRecargas(), 0);
});
