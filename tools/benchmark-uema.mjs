// Benchmark da base da Luma (UEMA e CTIC) SEM Gemini: indexa knowledge/luma/ no Chromium com o E5 e, para cada pergunta oficial (4 a 6 palavras),
// confere (1) se a pergunta é reconhecida como assunto da UEMA (vocabulário derivado dos documentos), (2) se a busca é confiante e (3) se o
// trecho certo vem em primeiro. Depois roda perguntas gerais e de matemática, que NÃO podem ser tomadas como assunto da UEMA.
// Uso: python serve.py 8771 (outro terminal) e depois  node tools/benchmark-uema.mjs
// O modelo E5 (118 MB) baixa do Hugging Face na primeira vez (autorizado na rodada R4). Gasta 0 de Gemini.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:8771';
// pergunta -> pedaço de texto que o trecho certo precisa conter
const OFICIAIS = [
  ['O que é a UEMA?', 'Universidade Estadual do Maranhão'],
  ['Lema e significado da UEMA', 'Produzir saberes para transformar vidas'],
  ['O que significa o CTIC?', 'Coordenadoria de Tecnologia da Informação e Comunicação'],
  ['Localização do Campus Paulo VI', 'Tirirical'],
  ['Para que serve o SigUema?', 'diário escolar digital'],
  ['Como o CTIC conecta a internet?', 'fibra óptica'],
  ['Como funciona o UemaNet?', 'educação a distância'],
  ['O que é o PAES UEMA?', 'Processo Seletivo Simplificado'],
  ['O que faz o HelpDesk?', 'socorristas de computadores'],
  ['Campi da UEMA no Maranhão', 'mais de 20 cidades'],
];
const GERAIS = ['Por que o céu é azul?', 'Quanto é 7 vezes 8?', 'Como ensinar frações para criança?', 'Me conta uma história de dragão', 'O que é um vulcão?', 'Como se faz um bolo?', 'Quem foi Santos Dumont?'];

const nav = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await nav.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
await page.goto(BASE + '/?debug'); // a CSP desta página libera o Hugging Face (pesos do E5); a do laboratório de vozes não
const r = await page.evaluate(async ({ oficiais, gerais }) => {
  const { criarEmbeddings } = await import('/src/rag/embeddings.js');
  const { criarRag } = await import('/src/rag/rag.js');
  const rag = criarRag({ embeddings: criarEmbeddings() });
  const t0 = performance.now();
  await rag.verificar('luma');
  await rag.preparar('luma');
  const indexou = Math.round(performance.now() - t0);
  const linhas = [];
  for (const [q, esperado] of oficiais) {
    const tema = await rag.ehDoTema('luma', q);
    const res = await rag.consultar('luma', q);
    const topo = res && res.resultados[0];
    linhas.push({ q, tema, confiante: !!(res && res.confiante), score: topo ? +topo.score.toFixed(3) : null, acertou: !!(topo && topo.texto.includes(esperado)), trecho: topo ? topo.id : null });
  }
  const outras = [];
  for (const q of gerais) outras.push({ q, tema: await rag.ehDoTema('luma', q) });
  return { indexou, linhas, outras, estado: rag.estado('luma') };
}, { oficiais: OFICIAIS, gerais: GERAIS });

console.log(`indexação: ${r.indexou} ms; ${JSON.stringify(r.estado)}`);
let ok = 0;
for (const l of r.linhas) {
  const bom = l.tema && l.confiante && l.acertou;
  if (bom) ok++;
  console.log(`${bom ? 'OK  ' : 'FALHA'} | tema=${l.tema} confiante=${l.confiante} score=${l.score} acertou=${l.acertou} | ${l.q} -> ${l.trecho}`);
}
console.log(`oficiais: ${ok} de ${r.linhas.length} com tema reconhecido, busca confiante e trecho certo em primeiro.`);
const vazadas = r.outras.filter((o) => o.tema);
for (const o of r.outras) console.log(`${o.tema ? 'FALHA' : 'OK  '} | geral tratada como assunto da UEMA? ${o.tema} | ${o.q}`);
console.log(vazadas.length ? `ATENÇÃO: ${vazadas.length} pergunta(s) geral(is) caíram no assunto da UEMA.` : 'Nenhuma pergunta geral caiu no assunto da UEMA.');
console.log('erros de página:', erros.length ? erros.slice(0, 3) : 'nenhum');
await nav.close();
process.exit(ok === r.linhas.length && !vazadas.length ? 0 : 1);
