// Proxy local do Gemini (prompt 3, U5, regra N3). A chave fica numa variável de ambiente DESTE processo e nunca chega ao
// navegador: o navegador só fala com este servidor. O proxy também conta o gasto (com os preços de src/custo.js) e aplica o
// teto: passado dele, responde 429 e o app cai sozinho para o plano gratuito.
//
// Uso:  GEMINI_API_KEY=... TETO_REAIS=50 npm run proxy      (Windows PowerShell: $env:GEMINI_API_KEY="..."; npm run proxy)
// No app: engrenagem, Orçamento, "Endereço do proxy local": http://127.0.0.1:8890
//
// Variáveis: GEMINI_API_KEY e/ou ELEVENLABS_API_KEY (ao menos uma; a rota da outra responde 503), TETO_REAIS (padrão 50), CAMBIO (padrão 5.17), PROXY_PORTA (8890),
//            PROXY_ORIGENS (origens do app aceitas, separadas por vírgula), LIMITE_POR_MINUTO (padrão 60),
//            UPSTREAM_GEMINI e UPSTREAM_ELEVENLABS (só para teste, apontam para um servidor falso).
// ElevenLabs (U4): POST /elevenlabs/v1/text-to-speech/{voiceId} -> api.elevenlabs.io, com a chave em xi-api-key. Só modelos da tabela
// de src/tts/elevenlabs.js; o gasto (caracteres x preço por 1.000) entra no mesmo teto acumulado do Gemini.
// O corpo das perguntas e a chave NUNCA são gravados nem escritos em log; só contadores.
import http from 'node:http';
import https from 'node:https';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PRECOS_USD, precoVigente, chaveDoModelo, CAMBIO_PADRAO } from '../../src/custo.js';
import { MODELOS_ELEVENLABS, usdDoTexto } from '../../src/tts/elevenlabs.js';

const PORTA = Number(process.env.PROXY_PORTA || 8890);
const UPSTREAM = new URL(process.env.UPSTREAM_GEMINI || 'https://generativelanguage.googleapis.com');
const TETO = Number(process.env.TETO_REAIS ?? 50);
const CAMBIO = Number(process.env.CAMBIO || CAMBIO_PADRAO);
const LIMITE_MIN = Number(process.env.LIMITE_POR_MINUTO || 60);
const ORIGENS = (process.env.PROXY_ORIGENS || 'http://localhost:8770,http://localhost:8771,http://127.0.0.1:8770,http://127.0.0.1:8771').split(',').map((s) => s.trim());
const ARQ = new URL('./uso.json', import.meta.url);
const CHAVE = process.env.GEMINI_API_KEY;
const CHAVE_ELEVEN = process.env.ELEVENLABS_API_KEY;
const UPSTREAM_ELEVEN = new URL(process.env.UPSTREAM_ELEVENLABS || 'https://api.elevenlabs.io');
if (!CHAVE && !CHAVE_ELEVEN) { console.error('Falta GEMINI_API_KEY ou ELEVENLABS_API_KEY no ambiente. O proxy não sobe sem uma delas (a chave nunca é lida de arquivo).'); process.exit(1); }

let uso = existsSync(ARQ) ? JSON.parse(readFileSync(ARQ, 'utf8')) : { acumUsd: 0, respostas: 0, porModelo: {} };
uso.vozes ||= { caracteres: 0, pedidos: 0, usd: 0, porModelo: {} };
const salvar = () => writeFileSync(ARQ, JSON.stringify(uso, null, 2));
const gastoReais = () => uso.acumUsd * CAMBIO;
let janela = []; // instantes dos últimos pedidos, para o limite por minuto

function cors(req, res) {
  const origem = req.headers.origin;
  if (origem && ORIGENS.includes(origem)) { res.setHeader('access-control-allow-origin', origem); res.setHeader('vary', 'origin'); }
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}
const json = (res, status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

// Voz ElevenLabs. Valida o corpo ANTES de gastar: modelo da tabela, texto de 1 a 5000 caracteres. Não grava o texto.
function voz(req, res, url, voiceId) {
  if (!CHAVE_ELEVEN) return json(res, 503, { error: { message: 'este proxy não tem ELEVENLABS_API_KEY' } });
  if (TETO > 0 && gastoReais() >= TETO) return json(res, 429, { error: { message: `teto de gasto atingido no proxy (R$ ${gastoReais().toFixed(2)} de R$ ${TETO})` } });
  const agora = Date.now();
  janela = janela.filter((t) => agora - t < 60_000);
  if (janela.length >= LIMITE_MIN) return json(res, 429, { error: { message: 'limite de pedidos por minuto atingido' } });
  janela.push(agora);
  const partes = []; let tamanho = 0;
  req.on('data', (c) => { tamanho += c.length; if (tamanho > 20_000) req.destroy(); else partes.push(c); });
  req.on('end', () => {
    let corpo;
    try { corpo = JSON.parse(Buffer.concat(partes).toString('utf8')); } catch { return json(res, 400, { error: { message: 'corpo não é JSON' } }); }
    const modelo = corpo.model_id || 'eleven_flash_v2_5';
    if (!MODELOS_ELEVENLABS[modelo]) return json(res, 400, { error: { message: `modelo ${modelo} fora da tabela de preços; não há como contar o gasto` } });
    if (typeof corpo.text !== 'string' || !corpo.text.trim() || corpo.text.length > 5000) return json(res, 400, { error: { message: 'texto vazio ou maior que 5000 caracteres' } });
    const formato = (url.searchParams.get('output_format') || 'mp3_44100_128').replace(/[^a-z0-9_]/g, '');
    const enviado = JSON.stringify({ text: corpo.text, model_id: modelo, ...(corpo.voice_settings ? { voice_settings: corpo.voice_settings } : {}) });
    const alvo = new URL(`/v1/text-to-speech/${voiceId}?output_format=${formato}`, UPSTREAM_ELEVEN);
    const lib = alvo.protocol === 'https:' ? https : http;
    const saida = lib.request(alvo, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(enviado), 'xi-api-key': CHAVE_ELEVEN } }, (r) => {
      res.writeHead(r.statusCode, { 'content-type': r.headers['content-type'] || 'audio/mpeg', 'cache-control': 'no-store' });
      r.pipe(res);
      r.on('end', () => {
        if (r.statusCode !== 200) return;
        const usd = usdDoTexto(corpo.text, modelo);
        uso.acumUsd += usd; uso.vozes.usd += usd; uso.vozes.caracteres += corpo.text.length; uso.vozes.pedidos++;
        const pm = uso.vozes.porModelo[modelo] || (uso.vozes.porModelo[modelo] = { caracteres: 0, pedidos: 0 });
        pm.caracteres += corpo.text.length; pm.pedidos++;
        salvar();
        console.log(`[proxy] elevenlabs ${modelo}: ${corpo.text.length} caracteres; acumulado R$ ${gastoReais().toFixed(4)} de R$ ${TETO}`);
      });
    });
    saida.on('error', (e) => { console.error('[proxy] falha ao falar com o ElevenLabs:', e.code || e.message); if (!res.headersSent) json(res, 502, { error: { message: 'o proxy não conseguiu falar com o ElevenLabs' } }); else res.end(); });
    saida.end(enviado);
  });
}

const servidor = http.createServer((req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const origem = req.headers.origin;
  if (origem && !ORIGENS.includes(origem)) return json(res, 403, { error: { message: 'origem não permitida' } });
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/saude') return json(res, 200, { ok: true });
  if (req.method === 'GET' && url.pathname === '/uso') {
    return json(res, 200, { acumuladoUsd: +uso.acumUsd.toFixed(4), acumuladoReais: +gastoReais().toFixed(2), tetoReais: TETO, pct: TETO ? +(gastoReais() / TETO).toFixed(3) : null, respostas: uso.respostas, porModelo: uso.porModelo, voz: uso.vozes });
  }
  const el = url.pathname.match(/^\/elevenlabs\/v1\/text-to-speech\/([A-Za-z0-9]{10,40})$/);
  if (req.method === 'POST' && el) return voz(req, res, url, el[1]);
  const m = url.pathname.match(/^\/gemini\/([a-z0-9.\-]+):streamGenerateContent$/);
  if (req.method !== 'POST' || !m) return json(res, 404, { error: { message: 'rota desconhecida' } });
  if (!CHAVE) return json(res, 503, { error: { message: 'este proxy não tem GEMINI_API_KEY' } });
  const modelo = m[1];
  const preco = precoVigente(PRECOS_USD[chaveDoModelo(modelo)]);
  // Nada pago sem passar pelo medidor: modelo fora da tabela de preços é recusado.
  if (!preco) return json(res, 400, { error: { message: `modelo ${modelo} fora da tabela de preços; não há como contar o gasto` } });
  if (TETO > 0 && gastoReais() >= TETO) return json(res, 429, { error: { message: `teto de gasto atingido no proxy (R$ ${gastoReais().toFixed(2)} de R$ ${TETO})` } });
  const agora = Date.now();
  janela = janela.filter((t) => agora - t < 60_000);
  if (janela.length >= LIMITE_MIN) return json(res, 429, { error: { message: 'limite de pedidos por minuto atingido' } });
  janela.push(agora);

  const partes = [];
  let tamanho = 0;
  req.on('data', (c) => { tamanho += c.length; if (tamanho > 1_000_000) req.destroy(); else partes.push(c); });
  req.on('end', () => {
    const corpo = Buffer.concat(partes);
    const alvo = new URL(`/v1beta/models/${modelo}:streamGenerateContent?alt=sse`, UPSTREAM);
    const lib = alvo.protocol === 'https:' ? https : http;
    const saida = lib.request(alvo, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': corpo.length, 'x-goog-api-key': CHAVE } }, (r) => {
      res.writeHead(r.statusCode, { 'content-type': r.headers['content-type'] || 'text/event-stream', 'cache-control': 'no-store' });
      let resto = '', ultimoUso = null;
      r.on('data', (c) => {
        res.write(c);
        // O usageMetadata chega em vários eventos com o acumulado da rodada; vale o último.
        resto += c.toString('utf8');
        const linhas = resto.split('\n'); resto = linhas.pop();
        for (const l of linhas) if (l.startsWith('data:')) { try { const u = JSON.parse(l.slice(5)).usageMetadata; if (u) ultimoUso = u; } catch { /* evento parcial */ } }
      });
      r.on('end', () => {
        res.end();
        if (r.statusCode === 200 && ultimoUso) {
          const ent = ultimoUso.promptTokenCount || 0, sai = (ultimoUso.candidatesTokenCount || 0) + (ultimoUso.thoughtsTokenCount || 0);
          const usd = (ent / 1e6) * preco.entrada + (sai / 1e6) * preco.saida;
          uso.acumUsd += usd; uso.respostas++;
          const pm = uso.porModelo[modelo] || (uso.porModelo[modelo] = { entrada: 0, saida: 0, respostas: 0 });
          pm.entrada += ent; pm.saida += sai; pm.respostas++;
          salvar();
          console.log(`[proxy] ${modelo}: ${ent} entrada, ${sai} saída; acumulado R$ ${gastoReais().toFixed(4)} de R$ ${TETO}`);
        }
      });
    });
    saida.on('error', (e) => { console.error('[proxy] falha ao falar com o Gemini:', e.code || e.message); if (!res.headersSent) json(res, 502, { error: { message: 'o proxy não conseguiu falar com o Gemini' } }); else res.end(); });
    saida.end(corpo);
  });
});

servidor.listen(PORTA, '127.0.0.1', () => console.log(`Proxy do Gemini em http://127.0.0.1:${PORTA}. Teto R$ ${TETO}, acumulado R$ ${gastoReais().toFixed(2)}. Só aceita origens: ${ORIGENS.join(', ')}`));
