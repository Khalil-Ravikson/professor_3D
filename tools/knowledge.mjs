// Valida os documentos de knowledge/<personagem>/ e gera knowledge/index.json (prompt 2, R4).
// Uso: node tools/knowledge.mjs            valida e grava knowledge/index.json
//      node tools/knowledge.mjs --verificar só valida (exit 1 se algo estiver fora da regra)
// Regras: todo documento (.md ou .txt) precisa de "fonte:" e "licenca:" no cabeçalho. Sem isso o arquivo é recusado.
// Também deriva, do texto dos documentos, o vocabulário do assunto de cada pasta (siglas com 2 ou mais ocorrências, menos as de
// metadados) e grava em index.json o padrão de regex já pronto: perguntas que citam esses termos são "do assunto" e só podem
// ser respondidas com a base (RAG, modo complemento). O vocabulário não é escrito à mão: muda quando os documentos mudam.
// Este script NÃO escreve conteúdo: sem documento, o personagem fica fora do index.json e segue sem base.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lerDocumento, dividirEmTrechos, contarPalavras } from '../src/rag/chunker.js';

const RAIZ = 'knowledge';
const soVerificar = process.argv.includes('--verificar');
let problemas = 0;
const personagens = {};
const temas = {};
const guiadas = {}; // demonstração guiada: só os itens que o dono aprovou (tools/guiada.mjs)
const META = new Set(['RAG', 'TTS', 'PDF', 'FAQ']); // siglas de instrução do documento, não do assunto
const MIN_OCORRENCIAS = 2;

if (!existsSync(RAIZ)) { console.log('Sem pasta knowledge/: nada a validar.'); process.exit(0); }
for (const pasta of readdirSync(RAIZ).filter((n) => statSync(join(RAIZ, n)).isDirectory())) {
  const arquivos = readdirSync(join(RAIZ, pasta)).filter((n) => /\.(md|txt)$/i.test(n)).sort();
  const gj = join(RAIZ, pasta, 'guiada.json');
  if (existsSync(gj)) {
    const itens = (JSON.parse(readFileSync(gj, 'utf8')).itens || []).filter((i) => i.aprovado === true).map(({ pergunta, resposta, fonte }) => ({ pergunta, resposta, fonte }));
    if (itens.length) { guiadas[pasta] = itens; console.log(`${pasta}: ${itens.length} itens da demonstração guiada aprovados.`); }
  }
  if (!arquivos.length) { console.log(`${pasta}: sem documentos (personagem fica sem base de conhecimento).`); continue; }
  let trechosTotal = 0, palavras = 0;
  const siglas = new Map();
  for (const a of arquivos) {
    const doc = lerDocumento(readFileSync(join(RAIZ, pasta, a), 'utf8'));
    if (doc.erros.length) { problemas++; console.error(`${pasta}/${a}: RECUSADO (${doc.erros.join('; ')})`); continue; }
    const t = dividirEmTrechos(doc, a);
    trechosTotal += t.length; palavras += contarPalavras(doc.corpo);
    for (const m of doc.corpo.matchAll(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]{2,}\b/g)) siglas.set(m[0], (siglas.get(m[0]) || 0) + 1);
    console.log(`${pasta}/${a}: ok, ${t.length} trechos (fonte: ${doc.fonte.slice(0, 60)})`);
  }
  personagens[pasta] = arquivos;
  const termos = [...siglas.entries()].filter(([s, n]) => n >= MIN_OCORRENCIAS && !META.has(s))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s.toLowerCase());
  if (termos.length) {
    temas[pasta] = {
      regra: `siglas de 3 letras ou mais com ${MIN_OCORRENCIAS} ou mais ocorrências nos documentos, sem ${[...META].join(', ')}`,
      termos,
      padrao: `\\b(${termos.join('|')})\\b`,
    };
    console.log(`${pasta}: vocabulário do assunto (${termos.length}): ${termos.join(', ')}`);
  }
  console.log(`${pasta}: ${arquivos.length} documentos, ${trechosTotal} trechos, ${palavras} palavras.`);
}
if (!soVerificar && !problemas) writeFileSync(join(RAIZ, 'index.json'), JSON.stringify({ personagens, temas, guiadas }, null, 2) + '\n');
process.exit(problemas ? 1 : 0);
