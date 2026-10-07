// Leitura de documentos e divisão em trechos para o RAG (prompt 2, R4). Puro: sem rede, sem navegador.
//
// Formato de um arquivo em knowledge/<personagem>/ (.md ou .txt):
//   fonte: de onde o conteúdo veio (documento, página ou URL)
//   licenca: licença ou permissão de uso
//   (linha em branco ou ---)
//   # Título do documento
//   texto, com seções marcadas por # ou ##
// Sem "fonte:" e sem "licenca:" o documento é recusado: a IA não escreve nem aceita conteúdo sem origem.

export const VERSAO_CHUNKER = 1;
export const PALAVRAS_MIN = 150;
export const PALAVRAS_MAX = 300;
export const SOBREPOSICAO = 30; // palavras repetidas do fim de um trecho no começo do seguinte

const contarPalavras = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export function lerDocumento(texto) {
  const erros = [];
  const linhas = String(texto || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const meta = {};
  let i = 0;
  for (; i < linhas.length; i++) {
    const l = linhas[i];
    if (!l.trim() || /^---+\s*$/.test(l)) { if (Object.keys(meta).length) { i++; break; } continue; }
    const m = l.match(/^(fonte|licen[cç]a)\s*:\s*(.+)$/i);
    if (!m) break;
    meta[m[1].toLowerCase().replace('ç', 'c')] = m[2].trim();
  }
  if (!meta.fonte) erros.push('falta "fonte:" no cabeçalho');
  if (!meta.licenca) erros.push('falta "licenca:" no cabeçalho');
  const corpo = linhas.slice(i).join('\n').trim();
  const tit = corpo.match(/^#\s+(.+)$/m);
  if (!corpo) erros.push('documento sem texto');
  return { fonte: meta.fonte || '', licenca: meta.licenca || '', titulo: tit ? tit[1].trim() : '', corpo, erros };
}

// Divide por seção (linhas que começam com #) e junta parágrafos até 150 a 300 palavras. O título do documento
// fica em todo trecho, e o fim de cada trecho se repete um pouco no seguinte.
export function dividirEmTrechos(doc, idDoc = 'doc') {
  const titulo = doc.titulo || idDoc;
  const secoes = [];
  let atual = { nome: titulo, linhas: [] };
  for (const l of doc.corpo.split('\n')) {
    const h = l.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      if (atual.linhas.join('').trim()) secoes.push(atual);
      atual = { nome: h[2].trim(), linhas: [] };
    } else atual.linhas.push(l);
  }
  if (atual.linhas.join('').trim()) secoes.push(atual);

  const trechos = [];
  const empurrar = (secao, palavras) => {
    const texto = palavras.join(' ');
    trechos.push({ id: `${idDoc}#${trechos.length + 1}`, titulo, secao, texto, palavras: palavras.length });
  };
  for (const s of secoes) {
    const paragrafos = s.linhas.join('\n').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    let buf = [];
    for (const p of paragrafos) {
      const pw = p.split(/\s+/);
      // Parágrafo gigante: corta em pedaços de PALAVRAS_MAX.
      const pedacos = [];
      for (let k = 0; k < pw.length; k += PALAVRAS_MAX) pedacos.push(pw.slice(k, k + PALAVRAS_MAX));
      for (const pe of pedacos) {
        if (buf.length && buf.length + pe.length > PALAVRAS_MAX) {
          empurrar(s.nome, buf);
          buf = buf.slice(-SOBREPOSICAO);
        }
        buf = buf.concat(pe);
      }
    }
    if (buf.length) empurrar(s.nome, buf);
  }
  // Trecho final curto demais (menos que metade do mínimo) vai para o anterior da mesma seção, se couber.
  for (let k = trechos.length - 1; k > 0; k--) {
    const t = trechos[k], ant = trechos[k - 1];
    if (t.palavras < PALAVRAS_MIN / 2 && t.secao === ant.secao && ant.palavras + t.palavras <= PALAVRAS_MAX + SOBREPOSICAO) {
      ant.texto += ' ' + t.texto; ant.palavras += t.palavras; trechos.splice(k, 1);
    }
  }
  trechos.forEach((t, n) => { t.id = `${idDoc}#${n + 1}`; });
  return trechos;
}

// O texto que vira vetor: título e seção junto do conteúdo, para o contexto não se perder.
export const textoParaVetor = (t) => `${t.titulo}. ${t.secao}.\n${t.texto}`;

export { contarPalavras };
