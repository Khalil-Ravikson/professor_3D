// Quadro de resolução (Teo, Rafa).
//
// Formato pedido ao modelo: cada linha começa com "FALA:" (vai para a voz e o balão)
// ou "QUADRO:" (vai para o quadro). Escolhi marcadores por linha e não JSON porque
// funcionam com o texto chegando aos pedaços (dá para falar antes da resposta terminar)
// e degradam bem: linha sem marcador vira fala, nada se perde.
//
// Conferência: todo número de uma linha do quadro precisa ter vindo do enunciado ou de
// uma chamada a calcular(). Número que não veio de lá aparece mascarado no quadro.

import { T } from './strings.pt-BR.js';

const MARCADOR = /^\s*(?:[-*#>]+\s*)*\**\s*\[?\s*(fala|quadro)\s*\]?\s*\**\s*:\s*\**\s*/i;
const LIMITE_PREFIXO = 24; // depois disso sem marcador, a linha é tratada como fala

// Leitor em fluxo: aoFala(pedaco) recebe o texto falado assim que se sabe o tipo da linha;
// aoQuadro(linha) recebe linhas completas do quadro.
export function criarLeitorMarcado({ aoFala, aoQuadro }) {
  let linha = '', tipo = null, semMarcador = 0, inicioDaFala = true;

  function decidir(final) {
    const m = linha.match(MARCADOR);
    if (m) {
      tipo = m[1].toLowerCase();
      linha = linha.slice(m[0].length);
      return true;
    }
    // Ainda pode virar "FALA:" ou "QUADRO:"? Então espera o próximo pedaço.
    const semEnfeite = linha.replace(/^\s*(?:[-*#>[]+\s*)*/, '');
    const prefixoPossivel = /^(f(a(l(a)?)?)?|q(u(a(d(r(o)?)?)?)?)?)?\s*\]?\s*\**\s*$/i.test(semEnfeite);
    if (!final && prefixoPossivel && linha.length <= LIMITE_PREFIXO) return false;
    tipo = 'fala';
    if (linha.trim()) semMarcador++;
    return true;
  }

  function escoar(final) {
    if (tipo === null && !decidir(final)) return;
    if (tipo === 'fala' && inicioDaFala) linha = linha.trimStart();
    if (tipo === 'fala' && linha) { aoFala(linha); linha = ''; inicioDaFala = false; }
  }

  function fecharLinha() {
    if (tipo === null) decidir(true);
    if (tipo === 'quadro') { if (linha.trim()) aoQuadro(linha.trim()); }
    else { if (linha) aoFala(linha); aoFala('\n'); }
    linha = ''; tipo = null; inicioDaFala = true;
  }

  return {
    adicionar(pedaco) {
      const partes = pedaco.replace(/\r\n?/g, '\n').split('\n');
      partes.forEach((p, i) => {
        linha += p;
        if (i < partes.length - 1) fecharLinha();
        else escoar(false);
      });
    },
    finalizar() { if (linha || tipo) fecharLinha(); },
    get linhasSemMarcador() { return semMarcador; },
  };
}

// Separa um texto completo (histórico, testes).
export function separarFalaEQuadro(texto) {
  let fala = '';
  const quadro = [];
  const l = criarLeitorMarcado({ aoFala: (t) => { fala += t; }, aoQuadro: (q) => quadro.push(q) });
  l.adicionar(texto);
  l.finalizar();
  return { fala: fala.replace(/\n{2,}/g, '\n').trim(), quadro, semMarcador: l.linhasSemMarcador };
}

/* ---------- Números ---------- */

// "1.000" pode ser mil (pt) ou 1 (en): devolve todos os valores plausíveis.
function valoresDe(token) {
  const vals = new Set();
  const ponto = token.includes('.'), virgula = token.includes(',');
  if (ponto && virgula) {
    vals.add(Number(token.replace(/\./g, '').replace(',', '.')));
  } else if (virgula) {
    vals.add(Number(token.replace(',', '.')));
    if (/^\d{1,3}(,\d{3})+$/.test(token)) vals.add(Number(token.replace(/,/g, '')));
  } else if (ponto) {
    if (/^\d+\.\d+$/.test(token)) vals.add(Number(token));
    if (/^\d{1,3}(\.\d{3})+$/.test(token)) vals.add(Number(token.replace(/\./g, '')));
  } else {
    vals.add(Number(token));
  }
  return [...vals].filter(Number.isFinite);
}

function casasDecimais(token) {
  const m = token.match(/[.,](\d+)$/);
  return m && !/^\d{1,3}([.,]\d{3})+$/.test(token) ? m[1].length : 0;
}

// Números de um texto, ignorando rótulos ("Passo 2"), ordinais ("1º") e expoentes (², ³).
export function extrairNumeros(texto) {
  const out = [];
  const re = /\d+(?:[.,]\d+)*/g;
  let m;
  while ((m = re.exec(texto))) {
    const antes = texto.slice(Math.max(0, m.index - 7), m.index);
    const depois = texto[m.index + m[0].length] || '';
    if (/passo\s*$/i.test(antes) || /[ºª°]/.test(depois)) continue;
    if (/[a-zA-Z_]$/.test(texto[m.index - 1] || '') && !/\s/.test(texto[m.index - 1])) continue; // x2, h2o
    out.push({ token: m[0], inicio: m.index, fim: m.index + m[0].length, valores: valoresDe(m[0]), casas: casasDecimais(m[0]) });
  }
  return out;
}

// Conjunto de valores permitidos: números do enunciado, das expressões e dos resultados
// de calcular. Inclui ×100 e ÷100 para porcentagens (0,85 ↔ 85%).
export function criarPermitidos(enunciado, contas) {
  const base = [];
  for (const n of extrairNumeros(enunciado || '')) base.push(...n.valores);
  for (const c of contas || []) {
    for (const n of extrairNumeros(c.expressao || '')) base.push(...n.valores);
    if (Number.isFinite(c.valor)) base.push(c.valor);
    for (const n of extrairNumeros(c.resultado || '')) base.push(...n.valores);
  }
  const todos = new Set();
  for (const v of base) { todos.add(v); todos.add(v * 100); todos.add(v / 100); todos.add(Math.abs(v)); }
  return [...todos];
}

function confere(numero, permitidos) {
  // Tolerância de arredondamento pelo número de casas mostradas: "0,67" confere com 0,6666...
  const tol = 0.5 * 10 ** -numero.casas + 1e-9;
  return numero.valores.some((v) => permitidos.some((p) => Math.abs(p - v) <= Math.max(tol, Math.abs(p) * 1e-9)));
}

// Devolve os pedaços da linha: { texto, conferido }. Pedaço com conferido=false é um número
// que não veio do enunciado nem da calculadora.
export function conferirLinha(linha, permitidos) {
  const pedacos = [];
  let pos = 0, suspeitos = 0;
  for (const n of extrairNumeros(linha)) {
    if (n.inicio > pos) pedacos.push({ texto: linha.slice(pos, n.inicio), conferido: true });
    const ok = confere(n, permitidos);
    if (!ok) suspeitos++;
    pedacos.push({ texto: n.token, conferido: ok, numero: true });
    pos = n.fim;
  }
  if (pos < linha.length) pedacos.push({ texto: linha.slice(pos), conferido: true });
  return { pedacos, suspeitos };
}

// "Passo 1: some 3 e 4" -> { rotulo: 'Passo 1', corpo: 'some 3 e 4' }
export function rotuloDaLinha(linha) {
  const m = linha.match(/^([\p{L}\d ]{2,20}):\s*(.*)$/u);
  return m ? { rotulo: m[1].trim(), corpo: m[2] } : { rotulo: '', corpo: linha };
}

/* ---------- Desenho (DOM) ---------- */

export function criarQuadro(raiz) {
  const lista = raiz.querySelector('.quadro-linhas');
  const contasEl = raiz.querySelector('.quadro-contas');
  let enunciado = '', contas = [], linhas = [];

  function desenharLinha(li, texto) {
    const permitidos = criarPermitidos(enunciado, contas);
    const { rotulo, corpo } = rotuloDaLinha(texto);
    const { pedacos, suspeitos } = conferirLinha(corpo, permitidos);
    li.replaceChildren();
    li.classList.toggle('resposta', /^(resposta|recomenda)/i.test(rotulo));
    if (rotulo) {
      const r = document.createElement('span');
      r.className = 'quadro-rotulo';
      r.textContent = rotulo;
      li.append(r);
    }
    const c = document.createElement('span');
    c.className = 'quadro-corpo';
    for (const p of pedacos) {
      if (p.conferido) { c.append(p.texto); continue; }
      const s = document.createElement('span');
      s.className = 'nao-conferido';
      s.textContent = '?';
      s.title = T.quadro.naoConferido;
      c.append(s);
    }
    li.append(c);
    li.dataset.suspeitos = String(suspeitos);
    if (suspeitos) li.setAttribute('aria-description', `${suspeitos} número não conferido`);
    else li.removeAttribute('aria-description');
  }

  // Uma conta nova pode conferir números de linhas já desenhadas.
  function redesenhar() { linhas.forEach(({ li, texto }) => desenharLinha(li, texto)); }

  return {
    limpar(novoEnunciado = '') {
      enunciado = novoEnunciado; contas = []; linhas = [];
      lista.replaceChildren(); contasEl.replaceChildren();
      raiz.dataset.vazio = 'sim';
    },
    adicionarLinha(texto) {
      const li = document.createElement('li');
      // "Suposição:" declara um valor assumido (preço, consumo). Ele passa a valer como dado,
      // mas a linha fica marcada como suposição, não como resultado.
      if (/^suposi/i.test(rotuloDaLinha(texto).rotulo)) {
        enunciado += ' ' + texto;
        li.classList.add('suposicao');
      }
      linhas.push({ li, texto });
      desenharLinha(li, texto);
      lista.append(li);
      raiz.dataset.vazio = 'nao';
      li.scrollIntoView({ block: 'nearest' });
    },
    adicionarConta(c) {
      contas.push(c);
      const li = document.createElement('li');
      li.textContent = c.erro ? `${c.expressao}  →  erro: ${c.erro}` : `${c.expressao} = ${c.resultado}`;
      if (c.erro) li.className = 'erro';
      contasEl.append(li);
      raiz.dataset.vazio = 'nao';
      redesenhar();
    },
    get estado() {
      return {
        linhas: linhas.map(({ li, texto }) => ({ texto, exibido: li.textContent, suspeitos: Number(li.dataset.suspeitos) })),
        contas: contas.slice(),
      };
    },
  };
}
