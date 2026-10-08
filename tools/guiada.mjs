// Demonstração guiada (prompt 3, U6): perguntas e respostas PRONTAS, aprovadas pelo dono, que funcionam sem internet.
//   node tools/guiada.mjs gerar <pasta> <arquivo.md>   extrai blocos "Pergunta: ... Resposta-base: ..." de um documento já em knowledge/<pasta>/
//                                                      e grava knowledge/<pasta>/guiada.json com aprovado: false em TODOS
//   node tools/guiada.mjs listar <pasta>               mostra cada item e se está aprovado
//   node tools/guiada.mjs aprovar <pasta> --todos | --ids 1,2,3     o DONO aprova depois de ler as respostas
// O script nunca aprova sozinho e não escreve resposta: só copia o que está no documento, com a fonte dele.
// Depois de aprovar, rode `npm run conhecimento` para o app ver (os itens aprovados vão para knowledge/index.json).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { lerDocumento } from '../src/rag/chunker.js';

const [cmd, pasta, terceiro] = process.argv.slice(2);
const arq = (p) => `knowledge/${p}/guiada.json`;
const limpo = (t) => t.replace(/\s+/g, ' ').trim();

if (!['gerar', 'listar', 'aprovar'].includes(cmd) || !pasta) { console.error('Uso: gerar <pasta> <arquivo.md> | listar <pasta> | aprovar <pasta> --todos|--ids 1,2'); process.exit(2); }

if (cmd === 'gerar') {
  if (!terceiro) { console.error('Informe o arquivo .md dentro de knowledge/<pasta>/.'); process.exit(2); }
  const caminho = `knowledge/${pasta}/${terceiro}`;
  const doc = lerDocumento(readFileSync(caminho, 'utf8'));
  if (doc.erros.length) { console.error(`${caminho}: ${doc.erros.join('; ')}`); process.exit(1); }
  const itens = [];
  for (const m of doc.corpo.matchAll(/Pergunta:\s*([\s\S]+?)\s*Resposta-base:\s*([\s\S]+?)(?=\n\s*#{1,6}\s|\n\s*Pergunta:|\s*$)/g)) {
    itens.push({ id: itens.length + 1, pergunta: limpo(m[1]), resposta: limpo(m[2]), fonte: `${terceiro} (${doc.fonte.slice(0, 90)})`, aprovado: false });
  }
  if (!itens.length) { console.error('Nenhum bloco "Pergunta: ... Resposta-base: ..." encontrado.'); process.exit(1); }
  writeFileSync(arq(pasta), JSON.stringify({ origem: terceiro, geradoEm: new Date().toISOString().slice(0, 10), itens }, null, 2) + '\n');
  console.log(`${itens.length} itens gravados em ${arq(pasta)}, TODOS com aprovado: false. Leia as respostas e aprove com "aprovar".`);
  process.exit(0);
}

if (!existsSync(arq(pasta))) { console.error(`Sem ${arq(pasta)}. Rode "gerar" antes.`); process.exit(1); }
const dados = JSON.parse(readFileSync(arq(pasta), 'utf8'));
if (cmd === 'listar') {
  for (const i of dados.itens) console.log(`${String(i.id).padStart(2)} [${i.aprovado ? 'aprovado' : 'PENDENTE'}] ${i.pergunta}\n     ${i.resposta.slice(0, 140)}${i.resposta.length > 140 ? '...' : ''}`);
  console.log(`${dados.itens.filter((i) => i.aprovado).length} de ${dados.itens.length} aprovados.`);
  process.exit(0);
}
// aprovar
const todos = process.argv.includes('--todos');
const ids = (process.argv[process.argv.indexOf('--ids') + 1] || '').split(',').map(Number).filter(Boolean);
if (!todos && !ids.length) { console.error('Diga quais: --todos ou --ids 1,2,3.'); process.exit(2); }
let n = 0;
for (const i of dados.itens) if (todos || ids.includes(i.id)) { if (!i.aprovado) n++; i.aprovado = true; }
writeFileSync(arq(pasta), JSON.stringify(dados, null, 2) + '\n');
console.log(`${n} item(ns) aprovado(s). Rode "npm run conhecimento" para o app ver.`);
