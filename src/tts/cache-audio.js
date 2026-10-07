// Cache de áudio das FRASES FIXAS em disco (IndexedDB), prompt 2, R3. Chave = motor + voz + velocidade + texto normalizado
// (a mesma chaveFrase de index.js), guardada como hash. Só entra o que a própria interface pré-sintetiza (cumprimento,
// despedida e amostra de voz) com motor gratuito: nunca a fala de uma resposta, que pode repetir o que a criança perguntou
// (PRODUCT.md: nenhum dado de criança é guardado), e nunca voz paga (voz paga nunca grava sozinha).
// Limite de 40 MB com remoção do menos usado (LRU). Se o disco não deixar guardar, só avisa e segue sem cache.
import { operar } from '../banco.js';

const DADOS = 'audio', META = 'audio_meta';
export const LIMITE_BYTES = 40e6;

export async function hashChave(chave) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(chave));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Devolve { canais: Float32Array[], taxa } ou null. Marca o uso para o LRU.
export async function lerAudio(chave) {
  const id = await hashChave(chave);
  const reg = await operar(DADOS, 'readonly', (l) => l.get(id));
  if (!reg) return null;
  operar(META, 'readwrite', (l) => l.put({ id, bytes: reg.bytes, uso: Date.now() })).catch((e) => console.warn('[cache-audio] não marcou o uso:', e));
  return { canais: reg.canais, taxa: reg.taxa };
}

async function tamanhoTotal() {
  const metas = (await operar(META, 'readonly', (l) => l.getAll())) || [];
  return { metas, total: metas.reduce((s, m) => s + (m.bytes || 0), 0) };
}

// Tira os menos usados até caber em `limite`.
async function limpar(limite = LIMITE_BYTES) {
  const { metas, total } = await tamanhoTotal();
  let sobra = total;
  for (const m of metas.sort((a, b) => a.uso - b.uso)) {
    if (sobra <= limite) break;
    await operar(DADOS, 'readwrite', (l) => l.delete(m.id));
    await operar(META, 'readwrite', (l) => l.delete(m.id));
    sobra -= m.bytes || 0;
  }
}

// buffer: AudioBuffer. Falha de cota limpa a metade do cache e tenta uma vez; depois disso, só avisa.
export async function gravarAudio(chave, buffer) {
  const id = await hashChave(chave);
  const canais = Array.from({ length: buffer.numberOfChannels }, (_, i) => new Float32Array(buffer.getChannelData(i)));
  const bytes = canais.reduce((s, c) => s + c.byteLength, 0);
  if (bytes > LIMITE_BYTES / 2) return false; // frase absurdamente grande: não vale ocupar o cache
  const escrever = async () => {
    await operar(DADOS, 'readwrite', (l) => l.put({ id, canais, taxa: buffer.sampleRate, bytes }));
    await operar(META, 'readwrite', (l) => l.put({ id, bytes, uso: Date.now() }));
  };
  try {
    await escrever();
  } catch (e) {
    if (e && (e.name === 'QuotaExceededError' || /quota|cota/i.test(String(e.message)))) {
      await limpar(LIMITE_BYTES / 2);
      await escrever();
    } else throw e;
  }
  await limpar();
  return true;
}

export async function tamanhoAudio() { return (await tamanhoTotal()).total; }

export async function apagarAudio() {
  const { metas } = await tamanhoTotal();
  for (const m of metas) { await operar(DADOS, 'readwrite', (l) => l.delete(m.id)); await operar(META, 'readwrite', (l) => l.delete(m.id)); }
  return metas.length;
}

// Volta a montar um AudioBuffer a partir do que foi lido.
export function paraAudioBuffer(ctx, { canais, taxa }) {
  const b = ctx.createBuffer(canais.length, canais[0].length, taxa);
  canais.forEach((c, i) => b.copyToChannel(c, i));
  return b;
}
