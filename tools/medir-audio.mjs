// Mede o volume de arquivos de áudio antes e depois da normalização que o app faz
// no navegador (src/audio.js), sem abrir navegador. Serve de aceite do P8.
//
// Uso: node tools/medir-audio.mjs [arquivo.wav ...]
// Sem argumentos, mede os áudios de amostras/.
// Saída: relatorios/p8-audio.json
//
// Só lê WAV PCM 16 ou 32 bits, sem compressão: é o que o pacote pré-gravado usa.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { planejarNormalizacao, ALVO } from '../src/audio.js';

// Leitor de WAV mínimo. Devolve um objeto com a mesma forma de um AudioBuffer
// no que interessa a medirBuffer: numberOfChannels, length, duration, getChannelData.
export function lerWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const texto = (p) => String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3));
  if (texto(0) !== 'RIFF' || texto(8) !== 'WAVE') throw new Error('não é WAV');
  let p = 12, fmt = null, dados = null;
  while (p + 8 <= v.byteLength) {
    const id = texto(p), tam = v.getUint32(p + 4, true);
    if (id === 'fmt ') fmt = { formato: v.getUint16(p + 8, true), canais: v.getUint16(p + 10, true), taxa: v.getUint32(p + 12, true), bits: v.getUint16(p + 22, true) };
    else if (id === 'data') dados = { inicio: p + 8, tam: Math.min(tam, v.byteLength - p - 8) };
    p += 8 + tam + (tam % 2); // pedaços têm tamanho par
  }
  if (!fmt || !dados) throw new Error('WAV sem fmt ou sem data');
  const pcmFloat = fmt.formato === 3;
  if (fmt.formato !== 1 && !pcmFloat) throw new Error(`WAV comprimido (formato ${fmt.formato}), não leio`);
  if (![16, 32].includes(fmt.bits)) throw new Error(`WAV de ${fmt.bits} bits, não leio`);
  const bytesPorAmostra = fmt.bits / 8;
  const quadros = Math.floor(dados.tam / (bytesPorAmostra * fmt.canais));
  const canais = Array.from({ length: fmt.canais }, () => new Float32Array(quadros));
  for (let q = 0; q < quadros; q++) {
    for (let c = 0; c < fmt.canais; c++) {
      const off = dados.inicio + (q * fmt.canais + c) * bytesPorAmostra;
      canais[c][q] = pcmFloat ? v.getFloat32(off, true)
        : fmt.bits === 16 ? v.getInt16(off, true) / 32768
        : v.getInt32(off, true) / 2147483648;
    }
  }
  return {
    numberOfChannels: fmt.canais,
    sampleRate: fmt.taxa,
    length: quadros,
    duration: quadros / fmt.taxa,
    getChannelData: (c) => canais[c],
  };
}

const alvos = process.argv.slice(2);
const arquivos = alvos.length
  ? alvos
  : (await readdir('amostras').catch(() => [])).filter((f) => f.toLowerCase().endsWith('.wav')).map((f) => join('amostras', f));

if (!arquivos.length) {
  console.error('Nenhum .wav para medir. Passe os arquivos ou coloque algum em amostras/.');
  process.exit(1);
}

const linhas = [];
for (const caminho of arquivos) {
  try {
    const buffer = lerWav(await readFile(caminho));
    const plano = planejarNormalizacao(buffer);
    linhas.push({ arquivo: basename(caminho), duracao: +buffer.duration.toFixed(2), taxa: buffer.sampleRate, canais: buffer.numberOfChannels, ...plano });
    console.log(
      `${basename(caminho)}  (${buffer.duration.toFixed(2)} s, ${buffer.sampleRate} Hz)\n` +
      `  antes:  RMS ${plano.antes.rmsDb} dBFS  pico ${plano.antes.picoDb} dBFS\n` +
      `  ganho:  ${plano.ganhoDb >= 0 ? '+' : ''}${plano.ganhoDb} dB (${plano.motivo})\n` +
      `  depois: RMS ${plano.depois.rmsDb} dBFS  pico ${plano.depois.picoDb} dBFS`,
    );
  } catch (e) {
    console.error(`${caminho}: ${e.message}`);
    linhas.push({ arquivo: basename(caminho), erro: e.message });
  }
}

const ok = linhas.filter((l) => !l.erro);
if (ok.length > 1) {
  const antes = ok.map((l) => l.antes.rmsDb), depois = ok.map((l) => l.depois.rmsDb);
  const espalhamento = (a) => +(Math.max(...a) - Math.min(...a)).toFixed(2);
  console.log(`\nDiferença de RMS entre o mais alto e o mais baixo: ${espalhamento(antes)} dB antes, ${espalhamento(depois)} dB depois.`);
}

await mkdir('relatorios', { recursive: true });
const destino = join('relatorios', 'p8-audio.json');
await writeFile(destino, JSON.stringify({
  medidoEm: new Date().toISOString().slice(0, 10),
  metodo: 'RMS e pico em dBFS sobre as amostras, com porta de silêncio. Não é LUFS do EBU R128.',
  alvo: ALVO,
  arquivos: linhas,
}, null, 2));
console.log(`\nRelatório: ${destino}`);
