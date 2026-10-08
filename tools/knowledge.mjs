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
// Nome de programa que também é palavra comum do português: casaria com perguntas de todo dia ("como ensinar frações?") e prenderia a resposta à base.
const AMBIGUAS = new Set(['ENSINAR']);
const semAcentos = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
  const siglas = new Map(); // siglas em maiúsculas e nomes em CamelCase (SigUema, UemaNet, HelpDesk), com contagem
  const frases = new Set(); // nomes próprios compostos das linhas "Pergunta:" (Campus Paulo VI)
  for (const a of arquivos) {
    const doc = lerDocumento(readFileSync(join(RAIZ, pasta, a), 'utf8'));
    if (doc.erros.length) { problemas++; console.error(`${pasta}/${a}: RECUSADO (${doc.erros.join('; ')})`); continue; }
    const t = dividirEmTrechos(doc, a);
    trechosTotal += t.length; palavras += contarPalavras(doc.corpo);
    for (const m of doc.corpo.matchAll(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]{2,}\b/g)) siglas.set(m[0], (siglas.get(m[0]) || 0) + 1);
    for (const m of doc.corpo.matchAll(/\b[A-ZÁÉÍÓÚ][a-záéíóúâêôãõç]+[A-Z][A-Za-záéíóúâêôãõç]*\b/g)) siglas.set(m[0], (siglas.get(m[0]) || 0) + 1);
    for (const l of doc.corpo.split('\n')) {
      const q = l.match(/^Pergunta:\s*(.+)$/);
      if (!q) continue;
      for (const m of q[1].matchAll(/\b[A-ZÁÉÍÓÚ][\wáéíóúâêôãõç]*(?:\s+(?:[A-ZÁÉÍÓÚ][\wáéíóúâêôãõç]*|[IVX]+)){1,3}\b/g)) {
        const p = m[0].split(/\s+/);
        frases.add(p.join(' ').toLowerCase());
        if (p.length > 2) frases.add(p.slice(-2).join(' ').toLowerCase()); // "paulo vi" também vale sozinho
      }
    }
    console.log(`${pasta}/${a}: ok, ${t.length} trechos (fonte: ${doc.fonte.slice(0, 60)})`);
  }
  personagens[pasta] = arquivos;
  const termos = [...new Set([
    ...[...siglas.entries()].filter(([s, n]) => n >= MIN_OCORRENCIAS && !META.has(s) && !AMBIGUAS.has(s.toUpperCase()))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s.toLowerCase()),
    ...frases,
  ])].map(semAcentos);
  if (termos.length) {
    temas[pasta] = {
      regra: `siglas e nomes em CamelCase com ${MIN_OCORRENCIAS} ou mais ocorrências nos documentos (sem ${[...META, ...AMBIGUAS].join(', ')}) e nomes próprios compostos das linhas "Pergunta:"`,
      termos,
      padrao: `\\b(${termos.join('|')})\\b`,
    };
    console.log(`${pasta}: vocabulário do assunto (${termos.length}): ${termos.join(', ')}`);
  }
  console.log(`${pasta}: ${arquivos.length} documentos, ${trechosTotal} trechos, ${palavras} palavras.`);
}
if (!soVerificar && !problemas) writeFileSync(join(RAIZ, 'index.json'), JSON.stringify({ personagens, temas, guiadas }, null, 2) + '\n');
process.exit(problemas ? 1 : 0);
