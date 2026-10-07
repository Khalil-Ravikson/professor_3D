// Gasto previsto por plano para um evento (prompt 3, U5): npm run orcamento -- [opções]
//   --estacoes N        totens ligados (padrão 1)
//   --sessoes-dia N     sessões por dia em cada totem (padrão 60)
//   --turnos N          perguntas por sessão (padrão 3)
//   --caracteres N      caracteres falados por resposta (padrão 300)
//   --dias N            dias de evento (padrão 1)
//   --teto R            teto em reais (padrão 50)
//   --modelo ID         modelo de texto (padrão gemini-3.1-flash-lite)
//   --voz ID            modelo de voz Gemini TTS (padrão gemini-3.8-flash-lite-tts)
//   --entrada N --saida N   tokens médios MEDIDOS por resposta; sem eles, usa a premissa de 2.000 e 200 (NÃO MEDIDA)
//   --falas N           falas fixas pré-gravadas no plano B (padrão 60)
//   --fracao F          fração das respostas com voz paga ao vivo no plano C (padrão 0,2)
// Margem de 15% sobre o previsto. Preços e câmbio vêm de src/custo.js e src/tts/gemini.js (lidos em 07/10/2026).
// Tudo em reais. O ElevenLabs NÃO entra: o preço não foi conferido na página do dia (regra: não inventar preço).
import { PRECOS_USD, PRECOS_FONTE, CAMBIO_PADRAO } from '../src/custo.js';
import { PREMISSA, usdTexto, usdVoz } from '../src/projecao.js';

const args = process.argv.slice(2);
const opt = (nome, padrao) => { const i = args.indexOf('--' + nome); return i >= 0 ? Number(String(args[i + 1]).replace(',', '.')) : padrao; };
const txt = (nome, padrao) => { const i = args.indexOf('--' + nome); return i >= 0 ? args[i + 1] : padrao; };

const estacoes = opt('estacoes', 1), sessoes = opt('sessoes-dia', 60), turnos = opt('turnos', 3), chars = opt('caracteres', 300), dias = opt('dias', 1);
const teto = opt('teto', 50), falas = opt('falas', 60), fracao = opt('fracao', 0.2);
const modelo = txt('modelo', 'gemini-3.1-flash-lite'), vozModelo = txt('voz', 'gemini-3.8-flash-lite-tts');
const medido = args.includes('--entrada') && args.includes('--saida');
const media = { ...PREMISSA, entrada: opt('entrada', PREMISSA.entrada), saida: opt('saida', PREMISSA.saida), caracteresFala: chars };
const MARGEM = 1.15;
const cambio = CAMBIO_PADRAO;

const respostas = estacoes * sessoes * turnos * dias;
const textoUsd = usdTexto(modelo, media);
if (textoUsd === null) { console.error(`Modelo ${modelo} fora da tabela de preços (${Object.keys(PRECOS_USD).join(', ')}).`); process.exit(1); }
const vozUsd = usdVoz(vozModelo, { caracteres: chars });
if (vozUsd === null) { console.error(`Modelo de voz ${vozModelo} fora da tabela.`); process.exit(1); }

const R = (usd) => usd * cambio;
const fmt = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');
const planos = [
  { nome: 'A. Mínimo: Kokoro ao vivo + texto', texto: respostas * textoUsd, voz: 0 },
  { nome: `B. Recomendado: A + ${falas} falas pré-gravadas (voz Gemini)`, texto: respostas * textoUsd, voz: falas * vozUsd },
  { nome: `C. Voz paga ao vivo em ${Math.round(fracao * 100)}% das respostas`, texto: respostas * textoUsd, voz: respostas * fracao * vozUsd },
  { nome: 'D. Voz paga ao vivo em todas as respostas', texto: respostas * textoUsd, voz: respostas * vozUsd },
];

console.log(`Evento: ${estacoes} totem(ns) x ${sessoes} sessões/dia x ${turnos} perguntas x ${dias} dia(s) = ${respostas} respostas de ${chars} caracteres.`);
console.log(`Texto: ${modelo}, ${media.entrada} tokens de entrada e ${media.saida} de saída por resposta (${medido ? 'MEDIDOS, informados por você' : 'premissa do REPERTORIO 23, NÃO MEDIDA'}). Voz: ${vozModelo}.`);
console.log(`Preços: ${PRECOS_FONTE}; voz em cloud.google.com/text-to-speech/pricing (07/10/2026). Dólar a R$ ${String(cambio).replace('.', ',')}. Margem de ${Math.round((MARGEM - 1) * 100)}%. Teto: ${fmt(teto)}.\n`);
console.log('Plano'.padEnd(66), 'Texto'.padStart(10), 'Voz'.padStart(10), 'Previsto'.padStart(10), 'Com margem'.padStart(11), '  Cabe no teto?');
for (const p of planos) {
  const prev = R(p.texto + p.voz), comMargem = prev * MARGEM;
  console.log(p.nome.padEnd(66), fmt(R(p.texto)).padStart(10), fmt(R(p.voz)).padStart(10), fmt(prev).padStart(10), fmt(comMargem).padStart(11), '  ' + (comMargem <= teto ? 'sim' : `não (passa ${fmt(comMargem - teto)})`));
}
const quantas = Math.floor(teto / (R(textoUsd) * MARGEM));
console.log(`\nSó texto, com margem: o teto de ${fmt(teto)} cobre cerca de ${quantas} respostas.`);
console.log('Gasto MEDIDO: veja a linha "Orçamento (teto)" no diagnóstico do app e `GET /uso` no proxy. A tabela de previsto contra medido em 30 turnos reais NÃO foi feita (o Gemini está bloqueado pelo teto de R$ 7 no AI Studio).');
