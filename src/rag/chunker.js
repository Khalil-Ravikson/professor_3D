// Leitura de documentos e divisão em trechos para o RAG (prompt 2, R4). Puro: sem rede, sem navegador.
//
// Formato de um arquivo em knowledge/<personagem>/ (.md ou .txt):
//   fonte: de onde o conteúdo veio (documento, página ou URL)
//   licenca: licença ou permissão de uso
//   (linha em branco ou ---)
//   # Título do documento
//   texto, com seções marcadas por # ou ##
// Sem "fonte:" e sem "licenca:" o documento é recusado: a IA não escreve nem aceita conteúdo sem origem.

export const VERSAO_CHUNKER = 2; // 2: corta em fim de frase, pergunta e resposta ficam num trecho só, seções pequenas se juntam, nunca sobra título (## ...) no texto
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

// Divide por seção (linhas que começam com #) e junta parágrafos até 150 a 300 palavras, sempre cortando em FIM DE FRASE. O título do
// documento fica em todo trecho e o fim de cada trecho se repete um pouco no seguinte (a última frase). Regras que evitam trechos ruins:
//  - o texto de um trecho nunca contém linha de título (# ou ##): o título vai em `secao`, nunca no fim do texto de outro trecho;
//  - uma seção com "Pergunta:" e "Resposta-base:" é UM trecho (pergunta, resposta e seção), para a busca achar a pergunta e a fala pronta sair inteira;
//  - seções curtas seguidas (menos de metade do mínimo) do mesmo documento se juntam, para o trecho ter contexto.
const FRASES = /(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“(])/;
const semTitulos = (t) => t.split('\n').filter((l) => !/^\s*#{1,6}\s/.test(l)).join('\n');
const limpar = (t) => semTitulos(t).replace(/\s+/g, ' ').trim();

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
  const empurrar = (secao, palavras, extra = {}) => {
    trechos.push({ id: '', titulo, secao, texto: palavras.join(' '), palavras: palavras.length, ...extra });
  };
  let pendente = null; // seção curta esperando a próxima para se juntar
  const soltarPendente = () => { if (pendente) { empurrar(pendente.secao, pendente.palavras); pendente = null; } };
  for (const s of secoes) {
    const corpo = limpar(s.linhas.join('\n'));
    const faq = corpo.match(/^Pergunta:\s*(.+?)\s*Resposta-base:\s*(.+)$/);
    if (faq) { // pergunta e resposta juntas, inteiras
      soltarPendente();
      empurrar(s.nome, corpo.split(/\s+/), { pergunta: faq[1].trim(), resposta: faq[2].trim() });
      continue;
    }
    const paragrafos = s.linhas.join('\n').split(/\n\s*\n/).map(limpar).filter(Boolean);
    // frases da seção, na ordem; frase maior que o máximo é partida em pedaços de palavras (último recurso)
    const frases = [];
    for (const p of paragrafos) for (const f of p.split(FRASES)) {
      const w = f.trim().split(/\s+/).filter(Boolean);
      for (let k = 0; k < w.length; k += PALAVRAS_MAX) frases.push(w.slice(k, k + PALAVRAS_MAX));
    }
    let buf = [];
    const novos = [];
    for (const f of frases) {
      if (buf.length && buf.length + f.length > PALAVRAS_MAX) {
        novos.push(buf);
        // sobreposição: a última frase do trecho anterior, se couber no limite
        const ult = buf.length ? frasesDe(buf).pop() : [];
        buf = ult.length <= SOBREPOSICAO ? ult.slice() : [];
      }
      buf = buf.concat(f);
    }
    if (buf.length) novos.push(buf);
    if (novos.length === 1 && novos[0].length < PALAVRAS_MIN / 2) { // seção curta: tenta juntar com a vizinha
      if (pendente && pendente.palavras.length + novos[0].length <= PALAVRAS_MAX) {
        pendente = { secao: `${pendente.secao}; ${s.nome}`, palavras: pendente.palavras.concat(novos[0]) };
        if (pendente.palavras.length >= PALAVRAS_MIN / 2) soltarPendente();
      } else { soltarPendente(); pendente = { secao: s.nome, palavras: novos[0] }; }
      continue;
    }
    soltarPendente();
    for (const n of novos) empurrar(s.nome, n);
  }
  soltarPendente();
  // Trecho final curto demais (menos que metade do mínimo) vai para o anterior da mesma seção, se couber.
  for (let k = trechos.length - 1; k > 0; k--) {
    const t = trechos[k], ant = trechos[k - 1];
    if (!t.pergunta && !ant.pergunta && t.palavras < PALAVRAS_MIN / 2 && t.secao === ant.secao && ant.palavras + t.palavras <= PALAVRAS_MAX + SOBREPOSICAO) {
      ant.texto += ' ' + t.texto; ant.palavras += t.palavras; trechos.splice(k, 1);
    }
  }
  trechos.forEach((t, n) => { t.id = `${idDoc}#${n + 1}`; });
  return trechos;
}
// Frases de uma lista de palavras (para achar a última). Só serve ao corte; fica junto do chunker.
function frasesDe(palavras) {
  return palavras.join(' ').split(FRASES).map((f) => f.split(/\s+/).filter(Boolean));
}

// O texto que vira vetor: título e seção junto do conteúdo, para o contexto não se perder.
export const textoParaVetor = (t) => `${t.titulo}. ${t.secao}.\n${t.texto}`;

export { contarPalavras };
