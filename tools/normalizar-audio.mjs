// Normaliza o volume de um pacote de áudio pré-gravado com o ffmpeg, em duas passagens.
//
// Uso:
//   node tools/normalizar-audio.mjs <pasta-de-entrada> [pasta-de-saida] [--alvo -16] [--tp -1.5] [--lra 7]
//
// Precisa do ffmpeg no PATH. Instalação no Windows: winget install Gyan.FFmpeg
//
// Por que duas passagens: na primeira o loudnorm só mede e imprime o resultado em JSON;
// na segunda esses números voltam como measured_* e o filtro aplica um ganho linear,
// sem compressão dinâmica. Em uma passagem só, o ffmpeg trabalha "ao vivo" e pode
// comprimir o começo do arquivo.
//
// Parâmetros do filtro loudnorm (conferido no código-fonte do ffmpeg,
// libavfilter/af_loudnorm.c, bloco loudnorm_options, em 06/10/2026):
//   I   loudness integrada alvo, em LUFS. Padrão do ffmpeg -24, faixa -70 a -5.
//   LRA faixa de loudness alvo, em LU. Padrão 7, faixa 1 a 50.
//   TP  teto de pico verdadeiro, em dBTP. Padrão -2, faixa -9 a 0.
//   linear liga o ganho linear (padrão 1), usado junto com os measured_*.
//   print_format aceita none, json e summary.
// Fonte: https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/af_loudnorm.c
//
// O alvo padrão deste script é -16 LUFS, e não -24: é uma escolha do projeto, não uma
// norma. O totem fica em corredor e feira, com barulho de fundo, e -24 LUFS fica baixo
// demais nas caixas de som comuns. Abaixe para -18 ou -20 se a sala for silenciosa.
import { execFile } from 'node:child_process';
import { readdir, mkdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const EXTENSOES = new Set(['.wav', '.mp3', '.m4a', '.ogg', '.opus', '.flac']);

function lerArgumentos(argv) {
  const soltos = [];
  const op = { alvo: -16, tp: -1.5, lra: 7 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--alvo') op.alvo = Number(argv[++i]);
    else if (a === '--tp') op.tp = Number(argv[++i]);
    else if (a === '--lra') op.lra = Number(argv[++i]);
    else soltos.push(a);
  }
  return { entrada: soltos[0], saida: soltos[1] || (soltos[0] && soltos[0] + '-normalizado'), ...op };
}

// Primeira passagem: medir. O loudnorm imprime o JSON no stderr.
async function medir(arquivo, op) {
  const filtro = `loudnorm=I=${op.alvo}:TP=${op.tp}:LRA=${op.lra}:print_format=json`;
  const { stderr } = await exec('ffmpeg', ['-hide_banner', '-nostats', '-i', arquivo, '-af', filtro, '-f', 'null', '-']);
  const bloco = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1);
  if (!bloco) throw new Error(`o ffmpeg não imprimiu o JSON do loudnorm para ${arquivo}`);
  return JSON.parse(bloco);
}

// Segunda passagem: aplicar o ganho com os números da primeira.
async function aplicar(arquivo, destino, m, op) {
  const filtro = [
    `loudnorm=I=${op.alvo}:TP=${op.tp}:LRA=${op.lra}:linear=true`,
    `measured_I=${m.input_i}`,
    `measured_LRA=${m.input_lra}`,
    `measured_TP=${m.input_tp}`,
    `measured_thresh=${m.input_thresh}`,
    `offset=${m.target_offset}`,
    'print_format=json',
  ].join(':');
  const { stderr } = await exec('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', arquivo, '-af', filtro, destino]);
  const bloco = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1);
  return bloco ? JSON.parse(bloco) : null;
}

const op = lerArgumentos(process.argv.slice(2));
if (!op.entrada) {
  console.error('Uso: node tools/normalizar-audio.mjs <pasta-de-entrada> [pasta-de-saida] [--alvo -16] [--tp -1.5] [--lra 7]');
  process.exit(1);
}

try {
  await exec('ffmpeg', ['-version']);
} catch {
  console.error('Não achei o ffmpeg no PATH. No Windows: winget install Gyan.FFmpeg');
  process.exit(1);
}

await mkdir(op.saida, { recursive: true });
const arquivos = (await readdir(op.entrada)).filter((f) => EXTENSOES.has(extname(f).toLowerCase()));
if (!arquivos.length) {
  console.error(`Nenhum áudio em ${op.entrada}.`);
  process.exit(1);
}

console.log(`Alvo: I=${op.alvo} LUFS, TP=${op.tp} dBTP, LRA=${op.lra} LU. ${arquivos.length} arquivo(s).\n`);
const linhas = [];
for (const f of arquivos) {
  const origem = join(op.entrada, f);
  const destino = join(op.saida, basename(f, extname(f)) + '.wav');
  try {
    const antes = await medir(origem, op);
    const depois = await aplicar(origem, destino, antes, op);
    linhas.push({ arquivo: f, antes, depois });
    console.log(
      `${f}\n  antes:  I=${antes.input_i} LUFS  TP=${antes.input_tp} dBTP  LRA=${antes.input_lra} LU` +
      (depois ? `\n  depois: I=${depois.output_i} LUFS  TP=${depois.output_tp} dBTP  LRA=${depois.output_lra} LU` : '\n  depois: o ffmpeg não imprimiu o JSON da segunda passagem'),
    );
  } catch (e) {
    console.error(`${f}: falhou. ${e.message}`);
  }
}

const relatorio = join(op.saida, 'normalizacao.json');
await (await import('node:fs/promises')).writeFile(relatorio, JSON.stringify({ alvo: op, arquivos: linhas }, null, 2));
console.log(`\nRelatório: ${relatorio}`);
