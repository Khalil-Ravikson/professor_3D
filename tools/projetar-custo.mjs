// Tabela de custo projetado do Gemini (texto + voz). Uso: node tools/projetar-custo.mjs [respostas] [teto_reais] [entrada saida]
// Com entrada e saída (tokens médios medidos por resposta), usa os medidos; sem eles, usa a premissa do REPERTORIO 23.
import { projetar, respostasQueCabem, usdCloudTts, PRECOS_CLOUD_TTS, PREMISSA } from '../src/projecao.js';
import { PRECOS_USD, PRECOS_FONTE, CAMBIO_PADRAO } from '../src/custo.js';

const [resp = '5000', teto = '50', ent, sai] = process.argv.slice(2);
const respostas = Number(resp), tetoReais = Number(teto);
const fmt = (v, c = 2) => (v === null ? 'sem preço' : 'R$ ' + v.toFixed(c).replace('.', ','));
const media = ent && sai ? { ...PREMISSA, entrada: Number(ent), saida: Number(sai) } : PREMISSA;

console.log(`Premissa: ${media.entrada} tokens de entrada, ${media.saida} de saída, ${media.caracteresFala} caracteres falados${ent ? ' (informados por você)' : ' (REPERTORIO 23, não medido)'}.`);
console.log(`Tudo em reais, com o dólar a R$ ${String(CAMBIO_PADRAO).replace(".", ",")} (editável no painel). Preços em dólar lidos em: ${PRECOS_FONTE}.
`);
console.log('Preço por 1 milhão de tokens, já em reais:');
for (const [m, p] of Object.entries(PRECOS_USD)) console.log(`  ${m.padEnd(24)} entrada ${fmt(p.entrada * CAMBIO_PADRAO)}  saída ${fmt(p.saida * CAMBIO_PADRAO)}`);
console.log();
for (const tts of [null, 'gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']) {
  console.log(tts ? `Texto + voz ${tts} (todas as respostas com voz paga):` : 'Só texto (voz Kokoro, custo zero):');
  for (const l of projetar({ respostas, media, modeloTts: tts })) {
    const cabem = respostasQueCabem(tetoReais, { modelo: l.modelo, media, modeloTts: tts });
    console.log(`  ${l.modelo.padEnd(24)} ${fmt(l.reaisPorResposta, 4).padStart(10)}/resposta  ${respostas} = ${fmt(l.reaisTotal).padStart(10)}  cabem ${cabem} no teto de R$ ${tetoReais}`);
  }
  console.log();
}
console.log(`Cloud Text-to-Speech por caractere (${respostas} respostas x ${media.caracteresFala} caracteres = ${(respostas * media.caracteresFala).toLocaleString('pt-BR')} no mês, franquia grátis mensal descontada):`);
for (const [tipo, p] of Object.entries(PRECOS_CLOUD_TTS)) {
  const usd = usdCloudTts(tipo, respostas * media.caracteresFala);
  console.log(`  ${tipo.padEnd(12)} ${fmt(p.usdPorMilhao * CAMBIO_PADRAO)}/milhão de caracteres, grátis ${p.gratisMes / 1e6} mi/mês  => ${fmt(usd * CAMBIO_PADRAO)}`);
}
console.log('  (a página não diz quais tipos têm voz em pt-BR: conferir antes de escolher)\n');
console.log('Modelos sem linha: ' + (Object.keys(PRECOS_USD).length ? 'nenhum na tabela' : 'todos'));
