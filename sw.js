// Service worker do Professores 3D (prompt 2, R3). Objetivo: o totem abrir e funcionar sem internet depois de uma
// primeira visita online. Três caches separados e versionados:
//   p3d-shell-<v>   página, módulos e estilos do app (rede primeiro, com o cache só como reserva offline; o prompt
//                   pede stale-while-revalidate para scripts, mas isso serviria código velho depois de cada edição)
//   p3d-bin-<n>     .vrm, .vrma, fontes, imagens, modelo do MediaPipe (cache primeiro; troque BIN ao trocar um arquivo)
//   p3d-cdn-<n>     bibliotecas da jsDelivr, sempre com versão fixa na URL (cache primeiro, nunca muda)
// NUNCA entram: chamadas à API do Gemini, ao servidor do Kokoro, qualquer POST, qualquer pedido com chave de API.
// Atualização controlada: uma versão nova instala e fica esperando. Só ativa quando a página manda { tipo: 'pular' }
// (o operador aceita no painel). Sem skipWaiting automático no meio de uma conversa.

const VERSAO = new URL(self.location.href).searchParams.get('v') || 'dev';
const BIN = 1; // subir quando um .vrm, .vrma, fonte ou imagem mudar de conteúdo com o mesmo nome
const CDN = 1;
const CACHE_SHELL = `p3d-shell-${VERSAO}`;
const CACHE_BIN = `p3d-bin-${BIN}`;
const CACHE_CDN = `p3d-cdn-${CDN}`;
const ATUAIS = [CACHE_SHELL, CACHE_BIN, CACHE_CDN];
const HOST_CDN = 'cdn.jsdelivr.net';

const EXT_BINARIA = /\.(vrm|vrma|woff2?|png|jpe?g|webp|svg|task|onnx|wasm|bin)$/i;
const EXT_ESTATICA = /\.(js|mjs|css|json)$/i;

self.addEventListener('install', (ev) => {
  // Pré-carrega só o essencial; o resto entra no cache conforme é usado. Falha de um item não derruba a instalação.
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE_SHELL);
    await Promise.allSettled(['./', 'index.html'].map((u) => c.add(new Request(u, { cache: 'reload' }))));
  })());
});

self.addEventListener('activate', (ev) => {
  // Apaga os caches antigos do app, e só eles.
  ev.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome.startsWith('p3d-') && !ATUAIS.includes(nome)) await caches.delete(nome);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (ev) => {
  if (ev.data && ev.data.tipo === 'pular') self.skipWaiting();
});

const temChave = (req, url) => req.headers.has('x-goog-api-key') || /[?&](key|api_key|apikey)=/i.test(url.search);

async function cachePrimeiro(req, nomeCache) {
  const c = await caches.open(nomeCache);
  const guardado = await c.match(req);
  if (guardado) return guardado;
  const r = await fetch(req);
  if (r.ok) c.put(req, r.clone()).catch((e) => console.warn('[sw] não coube no cache:', e));
  return r;
}

async function redePrimeiro(req, nomeCache) {
  const c = await caches.open(nomeCache);
  try {
    const r = await fetch(req);
    if (r.ok) c.put(req, r.clone()).catch((e) => console.warn('[sw] não coube no cache:', e));
    return r;
  } catch (erro) {
    const guardado = await c.match(req, { ignoreSearch: false });
    if (guardado) return guardado;
    throw erro;
  }
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return; // POST, PUT etc. passam direto
  const url = new URL(req.url);
  if (temChave(req, url)) return; // chave de API nunca é guardada
  if (url.origin === location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    if (EXT_BINARIA.test(url.pathname)) { ev.respondWith(cachePrimeiro(req, CACHE_BIN)); return; }
    if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) { ev.respondWith(redePrimeiro(req, CACHE_SHELL)); return; }
    if (EXT_ESTATICA.test(url.pathname)) { ev.respondWith(redePrimeiro(req, CACHE_SHELL)); return; }
    return;
  }
  // Só a jsDelivr, com versão fixa na URL (@x.y.z). Qualquer outro host passa direto: Gemini, Kokoro, Hugging Face.
  if (url.hostname === HOST_CDN && /@\d+\.\d+\.\d+/.test(url.pathname)) ev.respondWith(cachePrimeiro(req, CACHE_CDN));
});
