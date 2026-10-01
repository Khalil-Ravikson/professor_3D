// Divide texto em frases para a síntese de voz, inclusive com o texto chegando
// aos pedaços (streaming). Módulo puro, sem DOM: testado em tests/unit/frases.test.js.
//
// Regra principal: uma frase termina em . ! ? … (e aspas/parênteses de fechamento)
// SEGUIDOS DE ESPAÇO ou fim do texto. Isso já protege "3.5", "1.000" e "site.com".
// Exceções: abreviações conhecidas ("Sr. Silva"), iniciais ("J. Souza") e
// numeração de lista ("1. Primeiro").

const TERMINADORES = '.!?…';
const FECHAMENTOS = '"\')»”’]';
const ABREVIACOES = new Set([
  'sr', 'sra', 'srta', 'dr', 'dra', 'prof', 'profa', 'exmo', 'exma', 'ex', 'p', 'pág', 'págs',
  'aprox', 'obs', 'nº', 'n', 'vol', 'cap', 'fig', 'séc', 'av', 'tel', 'eng', 'jr', 'sto', 'sta',
]);

function ehEspaco(c) { return c === ' ' || c === '\n' || c === '\t' || c === '\r'; }

// Posição logo depois do fim da primeira frase completa, ou -1 se ainda não dá para saber.
function acharFim(buf, final) {
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c === '\n') {
      if (buf.slice(0, i).trim()) return i + 1;
      continue;
    }
    if (!TERMINADORES.includes(c)) continue;

    let j = i + 1;
    while (j < buf.length && TERMINADORES.includes(buf[j])) j++;
    while (j < buf.length && FECHAMENTOS.includes(buf[j])) j++;
    if (j >= buf.length) return final ? j : -1; // pode vir mais texto colado (ex.: "3." + "5")
    if (!ehEspaco(buf[j])) { i = j - 1; continue; }

    if (c === '.' && j === i + 1) {
      const antes = buf.slice(0, i);
      const palavra = (antes.match(/[\p{L}º]+$/u) || [''])[0];
      if (ABREVIACOES.has(palavra.toLowerCase())) continue;
      if (palavra.length === 1 && palavra === palavra.toUpperCase() && /\p{Lu}/u.test(palavra)) continue;
      if (/^\s*\d+$/.test(antes.slice(antes.lastIndexOf('\n') + 1))) continue;
    }
    return j;
  }
  return -1;
}

// Quando o texto passa de `maximo` sem ponto final, corta na última vírgula,
// ponto e vírgula ou dois-pontos (não entre dígitos, para não partir "3,5").
function acharCorteSuave(buf, maximo) {
  const janela = buf.slice(0, maximo);
  for (let i = janela.length - 1; i >= Math.floor(maximo / 3); i--) {
    const c = janela[i];
    if ((c === ',' || c === ';' || c === ':') && ehEspaco(buf[i + 1] || '') && !/\d/.test(buf[i + 2] || '')) return i + 1;
  }
  const espaco = janela.lastIndexOf(' ');
  return espaco > maximo / 3 ? espaco : maximo;
}

export function criarDivisor({ maximo = 180 } = {}) {
  let buf = '';
  function extrair(final) {
    const saida = [];
    for (;;) {
      let fim = acharFim(buf, final);
      if (fim < 0 && buf.length > maximo) fim = acharCorteSuave(buf, maximo);
      if (fim < 0) break;
      const frase = buf.slice(0, fim).trim();
      buf = buf.slice(fim);
      if (frase) saida.push(frase);
    }
    if (final) {
      const resto = buf.trim();
      buf = '';
      if (resto) saida.push(resto);
    }
    return saida;
  }
  return {
    adicionar(pedaco) { buf += pedaco; return extrair(false); },
    finalizar() { return extrair(true); },
  };
}

export function dividirFrases(texto, opcoes) {
  const d = criarDivisor(opcoes);
  return [...d.adicionar(texto), ...d.finalizar()];
}

// Símbolos em palavras, só para o que vai ao TTS (o balão e o quadro mostram o original).
// O Kokoro-FastAPI não tem normalização para português ("none registered for lang_code 'p'").
const UNIDADES = [
  [/(\d)\s*m²/g, '$1 metros quadrados'], [/(\d)\s*m³/g, '$1 metros cúbicos'],
  [/(\d)\s*cm²/g, '$1 centímetros quadrados'], [/(\d)\s*km\/h/g, '$1 quilômetros por hora'],
  [/(\d)\s*km\b/g, '$1 quilômetros'], [/(\d)\s*cm\b/g, '$1 centímetros'], [/(\d)\s*mm\b/g, '$1 milímetros'],
  [/(\d)\s*kg\b/g, '$1 quilos'], [/(\d)\s*kWh\b/g, '$1 quilowatts-hora'], [/(\d)\s*m\b/g, '$1 metros'],
  [/R\$\s*(\d+(?:[.,]\d+)*)/g, '$1 reais'],
];
export function normalizarParaFala(t) {
  let s = t;
  for (const [re, sub] of UNIDADES) s = s.replace(re, sub);
  return s
    .replace(/(\d)\s*%/g, '$1 por cento')
    .replace(/(\d)\s*[×*]\s*(\d)/g, '$1 vezes $2')
    .replace(/(\d)\s*÷\s*(\d)/g, '$1 dividido por $2')
    .replace(/(\d)\s*\+\s*(\d)/g, '$1 mais $2')
    // "5-10 minutos" é intervalo: o hífen só vira "menos" com espaços em volta; o "−" tipográfico sempre.
    .replace(/(\d)\s+-\s+(\d)/g, '$1 menos $2')
    .replace(/(\d)\s*−\s*(\d)/g, '$1 menos $2')
    .replace(/\s*=\s*/g, ' é igual a ')
    .replace(/(\d)\s*\/\s*(\d)/g, '$1 sobre $2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Remove o que não deve ser lido em voz alta: emoji e marcação de markdown.
export function limparParaFala(t) {
  return t
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/[*_#`>~]/g, '');
}
