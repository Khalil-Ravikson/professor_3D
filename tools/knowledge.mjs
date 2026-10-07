// Valida os documentos de knowledge/<personagem>/ e gera knowledge/index.json (prompt 2, R4).
// Uso: node tools/knowledge.mjs            valida e grava knowledge/index.json
//      node tools/knowledge.mjs --verificar só valida (exit 1 se algo estiver fora da regra)
// Regras: todo documento (.md ou .txt) precisa de "fonte:" e "licenca:" no cabeçalho. Sem isso o arquivo é recusado.
// Este script NÃO escreve conteúdo: sem documento, o personagem fica fora do index.json e segue sem base.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lerDocumento, dividirEmTrechos, contarPalavras } from '../src/rag/chunker.js';

const RAIZ = 'knowledge';
const soVerificar = process.argv.includes('--verificar');
let problemas = 0;
const personagens = {};

if (!existsSync(RAIZ)) { console.log('Sem pasta knowledge/: nada a validar.'); process.exit(0); }
for (const pasta of readdirSync(RAIZ).filter((n) => statSync(join(RAIZ, n)).isDirectory())) {
  const arquivos = readdirSync(join(RAIZ, pasta)).filter((n) => /\.(md|txt)$/i.test(n)).sort();
  if (!arquivos.length) { console.log(`${pasta}: sem documentos (personagem fica sem base de conhecimento).`); continue; }
  let trechosTotal = 0, palavras = 0;
  for (const a of arquivos) {
    const doc = lerDocumento(readFileSync(join(RAIZ, pasta, a), 'utf8'));
    if (doc.erros.length) { problemas++; console.error(`${pasta}/${a}: RECUSADO (${doc.erros.join('; ')})`); continue; }
    const t = dividirEmTrechos(doc, a);
    trechosTotal += t.length; palavras += contarPalavras(doc.corpo);
    console.log(`${pasta}/${a}: ok, ${t.length} trechos (fonte: ${doc.fonte.slice(0, 60)})`);
  }
  personagens[pasta] = arquivos;
  console.log(`${pasta}: ${arquivos.length} documentos, ${trechosTotal} trechos, ${palavras} palavras.`);
}
if (!soVerificar && !problemas) writeFileSync(join(RAIZ, 'index.json'), JSON.stringify({ personagens }, null, 2) + '\n');
process.exit(problemas ? 1 : 0);
