// Atualiza a Content-Security-Policy do index.html. O importmap é um script inline, então a política precisa do hash
// exato do conteúdo dele; rode `node tools/csp.mjs` sempre que mexer no importmap. `--verificar` só confere (exit 1 se velho).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ARQ = 'index.html';
const html = readFileSync(ARQ, 'utf8');
const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!m) { console.error('importmap não encontrado'); process.exit(2); }
// O navegador normaliza CRLF para LF ao ler o script inline: o hash vale para o texto com LF (no Windows o git pode entregar CRLF).
const hash = 'sha256-' + createHash('sha256').update(m[1].replace(/\r\n/g, '\n')).digest('base64');

// Hosts realmente usados (conferidos no código): jsDelivr (bibliotecas fixas), Gemini, Hugging Face (modelos do
// Whisper e do Kokoro no navegador), servidor local do Kokoro (porta configurável).
const politica = [
  "default-src 'self'",
  `script-src 'self' '${hash}' https://cdn.jsdelivr.net blob: 'wasm-unsafe-eval'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  "connect-src 'self' https://generativelanguage.googleapis.com https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co http://127.0.0.1:* http://localhost:* blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const meta = `<meta http-equiv="Content-Security-Policy" content="${politica}">`;

const atual = html.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/);
if (process.argv.includes('--verificar')) {
  if (!atual || atual[0] !== meta) { console.error('CSP desatualizada: rode node tools/csp.mjs'); process.exit(1); }
  console.log('CSP em dia (' + hash + ')'); process.exit(0);
}
const novo = atual ? html.replace(atual[0], meta) : html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + meta);
writeFileSync(ARQ, novo, 'utf8');
console.log('CSP gravada. Hash do importmap: ' + hash);
