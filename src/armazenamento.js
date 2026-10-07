// Lado da página do cache offline (prompt 2, R3): registra o service worker (sw.js), mede o uso, apaga por categoria
// e baixa personagens para uso offline. Nenhuma chave de API passa por aqui.

// Os nomes seguem o sw.js. Se mudar lá (BIN, CDN), mude aqui.
export const CACHE_BIN = 'p3d-bin-1';
export const CACHE_CDN = 'p3d-cdn-1';
import { tamanhoAudio, apagarAudio } from './tts/cache-audio.js';

const PREFIXO = 'p3d-';

export const temServiceWorker = () => 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

// versao entra na URL do worker: versão nova do app vira um worker novo, que instala e espera.
export async function registrarSW(versao, { aoNova = () => {}, aoErro = () => {} } = {}) {
  if (!temServiceWorker()) return null;
  try {
    const reg = await navigator.serviceWorker.register(`sw.js?v=${encodeURIComponent(versao)}`);
    const avisar = () => { if (reg.waiting && navigator.serviceWorker.controller) aoNova(reg); };
    avisar();
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if (novo) novo.addEventListener('statechange', () => { if (novo.state === 'installed') avisar(); });
    });
    return reg;
  } catch (e) {
    console.warn('[armazenamento] service worker não registrou:', e);
    aoErro(e);
    return null;
  }
}

// Só quando a pessoa aceitar. Depois de ativar, recarrega para a página nova assumir.
export function aplicarAtualizacao(reg) {
  if (!reg || !reg.waiting) return false;
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  reg.waiting.postMessage({ tipo: 'pular' });
  return true;
}

// Chamar dentro de um gesto do usuário: sem ele o navegador costuma negar.
export async function pedirPersistencia() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try { return await navigator.storage.persist(); } catch (e) { console.warn('[armazenamento] persist falhou:', e); return false; }
}

export async function usoEcota() {
  const base = { usado: null, cota: null, persistente: null };
  if (!navigator.storage) return base;
  try {
    const e = navigator.storage.estimate ? await navigator.storage.estimate() : {};
    return { usado: e.usage ?? null, cota: e.quota ?? null, persistente: navigator.storage.persisted ? await navigator.storage.persisted() : null };
  } catch (e) {
    console.warn('[armazenamento] estimate falhou:', e);
    return base;
  }
}

async function tamanhoDe(resposta) {
  const cl = Number(resposta.headers.get('content-length'));
  if (cl > 0) return cl;
  try { return (await resposta.clone().blob()).size; } catch (e) { console.warn('[armazenamento] sem tamanho:', e); return 0; }
}

// Bytes por categoria. "shell" junta todas as versões do app que ainda existirem.
export async function tamanhosPorCategoria() {
  const total = { shell: 0, binarios: 0, bibliotecas: 0, audio: 0 };
  try { total.audio = await tamanhoAudio(); } catch (e) { console.warn('[armazenamento] sem tamanho do áudio:', e); }
  if (!window.caches) return total;
  for (const nome of await caches.keys()) {
    if (!nome.startsWith(PREFIXO)) continue;
    const chave = nome.startsWith('p3d-bin') ? 'binarios' : nome.startsWith('p3d-cdn') ? 'bibliotecas' : 'shell';
    const c = await caches.open(nome);
    for (const req of await c.keys()) { const r = await c.match(req); if (r) total[chave] += await tamanhoDe(r); }
  }
  return total;
}

export async function apagarCategoria(categoria) {
  let n = 0;
  if (categoria === 'audio' || categoria === 'tudo') { try { n += (await apagarAudio()) > 0 ? 1 : 0; } catch (e) { console.warn('[armazenamento] não apagou o áudio:', e); } }
  if (categoria === 'audio' || !window.caches) return n;
  for (const nome of await caches.keys()) {
    if (!nome.startsWith(PREFIXO)) continue;
    const ehBin = nome.startsWith('p3d-bin'), ehCdn = nome.startsWith('p3d-cdn');
    const alvo = categoria === 'tudo' || (categoria === 'binarios' && ehBin) || (categoria === 'bibliotecas' && ehCdn) || (categoria === 'shell' && !ehBin && !ehCdn);
    if (alvo && await caches.delete(nome)) n++;
  }
  return n;
}

// urls: caminhos relativos dos .vrm. Devolve { url: true/false }.
export async function prontoOffline(urls) {
  const saida = {};
  if (!window.caches) { for (const u of urls) saida[u] = false; return saida; }
  const c = await caches.open(CACHE_BIN);
  for (const u of urls) saida[u] = !!(await c.match(new URL(u, location.href).href));
  return saida;
}

// Baixa uma lista de arquivos para o cache de binários, com progresso por arquivo.
// QuotaExceededError vira um aviso: nada de falhar calado.
export async function baixarParaOffline(urls, aoProgresso = () => {}) {
  if (!window.caches) throw new Error('Este navegador não guarda arquivos para uso offline.');
  const c = await caches.open(CACHE_BIN);
  let feitos = 0;
  for (const u of urls) {
    const href = new URL(u, location.href).href;
    if (!(await c.match(href))) {
      const r = await fetch(href);
      if (!r.ok) throw new Error(`Não consegui baixar ${u} (HTTP ${r.status}).`);
      try { await c.put(href, r); } catch (e) {
        if (e && e.name === 'QuotaExceededError') throw new Error('O navegador não tem espaço para guardar isso. Apague uma categoria e tente de novo.');
        throw e;
      }
    }
    aoProgresso(++feitos, urls.length);
  }
}

export const formatarBytes = (b) => (b === null || b === undefined ? 'sem dado' : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);
