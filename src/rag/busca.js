// Busca híbrida do RAG (prompt 2, R4): cosseno em força bruta mais palavra-chave, fundidos por Reciprocal Rank Fusion.
// Puro: recebe vetores e textos, devolve a lista ordenada. Vetores já vêm normalizados (L2), então cosseno = produto interno.

// O E5 dá cosseno alto até para assunto sem relação. Medido em 07/10/2026 com um corpus de teste de só 2 trechos de matemática:
// dentro da base 0,92 e 0,95; fora da base 0,75 (copa do mundo) e 0,81 (receita de bolo). Por isso 0,85. NÃO CALIBRADO com o corpus real:
// recalibrar com 10 perguntas dentro e 5 fora, usando "Testar uma pergunta" no painel.
export const LIMIAR_PADRAO = 0.85;
export const K_RRF = 60;

const PARADAS = new Set(('a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre e ou mas que se ' +
  'como mais menos muito muita ja foi sao ser tem ter ha eh ao aos ate entre quando onde qual quais quem seu sua seus suas este esta ' +
  'esse essa isso isto aquele aquela eu voce nos eles elas me te lhe meu minha').split(' '));

export const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function tokenizar(t) {
  return semAcento(t).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !PARADAS.has(w));
}

export function cosseno(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

// BM25 simples sobre os tokens dos trechos. df: documentos (trechos) em que cada termo aparece.
export function prepararPalavraChave(trechos) {
  const docs = trechos.map((t) => tokenizar(`${t.titulo} ${t.secao} ${t.texto}`));
  const df = new Map();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);
  const media = docs.reduce((s, d) => s + d.length, 0) / (docs.length || 1);
  return { docs, df, media, N: docs.length };
}

export function pontuarPalavraChave(consulta, prep, i, k1 = 1.5, b = 0.75) {
  const q = tokenizar(consulta);
  const d = prep.docs[i];
  if (!d.length || !q.length) return 0;
  const freq = new Map();
  for (const w of d) freq.set(w, (freq.get(w) || 0) + 1);
  let s = 0;
  for (const w of new Set(q)) {
    const f = freq.get(w) || 0;
    if (!f) continue;
    const n = prep.df.get(w) || 0;
    const idf = Math.log(1 + (prep.N - n + 0.5) / (n + 0.5));
    s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (d.length / prep.media))));
  }
  return s;
}

// listas: arrays de ids em ordem de relevância. Devolve Map id -> pontuação fundida.
export function rrf(listas, k = K_RRF) {
  const m = new Map();
  for (const lista of listas) lista.forEach((id, pos) => m.set(id, (m.get(id) || 0) + 1 / (k + pos + 1)));
  return m;
}

// trechos: [{ id, titulo, secao, texto, vetor }]. Devolve { confiante, melhorCosseno, resultados[] } com até k trechos.
// confiante: o melhor cosseno entre os trechos chegou ao limiar. Abaixo disso o personagem diz que não sabe.
export function buscar({ consulta, vetorConsulta, trechos, k = 4, limiar = LIMIAR_PADRAO }) {
  if (!trechos.length) return { confiante: false, melhorCosseno: 0, resultados: [] };
  const cos = trechos.map((t) => cosseno(vetorConsulta, t.vetor));
  const prep = prepararPalavraChave(trechos);
  const kw = trechos.map((_, i) => pontuarPalavraChave(consulta, prep, i));
  const ordem = (valores) => valores.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  const listaCos = ordem(cos).slice(0, 20).map((i) => trechos[i].id);
  const listaKw = ordem(kw).filter((i) => kw[i] > 0).slice(0, 20).map((i) => trechos[i].id);
  const fundido = rrf([listaCos, listaKw]);
  const porId = new Map(trechos.map((t, i) => [t.id, { trecho: t, cos: cos[i], kw: kw[i] }]));
  const resultados = [...fundido.entries()].sort((a, b) => b[1] - a[1]).slice(0, k)
    .map(([id, score]) => ({ ...porId.get(id).trecho, vetor: undefined, score, cosseno: porId.get(id).cos, palavraChave: porId.get(id).kw }));
  const melhorCosseno = Math.max(...cos);
  return { confiante: melhorCosseno >= limiar, melhorCosseno, resultados };
}
