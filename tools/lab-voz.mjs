// Laboratório de voz: cronometra o Gemini TTS (e o Kokoro local, como linha de base) com as mesmas frases.
//
// Uso: python serve.py 8771 (outro terminal) e depois
//   node tools/lab-voz.mjs [--rapido] [--sem-kokoro] [--so-stream]
//
// Roda dentro do Chromium (Playwright): é o mesmo ambiente em que o app vai usar o motor, e nesta
// máquina o Node e o curl não alcançam o Google, o navegador sim. A chave vem de .env.local, vive só
// na memória do processo e nunca é impressa nem gravada.
//
// GASTA DINHEIRO REAL no Gemini (centavos): a matriz completa são ~30 chamadas de 3 a 20 s de áudio.
// --rapido roda 1 modelo, 1 voz e 3 frases.
//
// Saída: relatorios/voz/telemetria.json, relatorios/voz/resumo.md e os áudios em relatorios/voz/audio/
// (ignorados pelo git).
import { chromium } from '@playwright/test';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8771';
const rapido = process.argv.includes('--rapido');
const semKokoro = process.argv.includes('--sem-kokoro');
const soStream = process.argv.includes('--so-stream');
const CAMBIO = Number(process.env.CAMBIO) || 5.17; // REPERTORIO 23; editável

const chave = existsSync('.env.local') ? ((readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m) || [])[1] || '').trim() : '';
if (!chave) { console.error('Falta GEMINI_API_KEY em .env.local.'); process.exit(1); }

// Frases do laboratório (REPERTORIO 22): nomes difíceis, número e data por extenso, pergunta, exclamação e uma longa.
// Nenhuma afirma fato sobre a UEMA: só põem os nomes à prova.
const FRASES = [
  { id: 'curta', texto: 'Oi! Eu sou a Luma. Esta é a minha voz.' },
  { id: 'nomes', texto: 'Maranhão, UEMA, Imperatriz e Caxias são nomes difíceis de falar.' },
  { id: 'numeros', texto: 'Hoje é dia seis de outubro de dois mil e vinte e seis, e sete vezes oito é cinquenta e seis.' },
  { id: 'pergunta', texto: 'Você sabia que o céu é azul por causa da luz do sol?' },
  { id: 'exclamacao', texto: 'Que legal! Vamos fazer uma conta juntos!' },
  { id: 'longa', texto: 'Para somar frações, primeiro a gente precisa de um denominador comum. Depois é só somar os numeradores e guardar o denominador. Quer tentar com dois terços e três quartos? Eu te ajudo em cada passo, sem pressa.' },
];
const MODELOS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'];
const VOZES = ['Kore', 'Puck'];
const ESTILO = 'fale devagar e com paciência, como uma professora que explica para crianças';

// A matriz.
let casos = [];
if (rapido) {
  for (const f of FRASES.slice(0, 3)) casos.push({ modelo: MODELOS[1], voz: 'Kore', estilo: '', frase: f });
} else {
  for (const m of MODELOS) for (const v of VOZES) for (const f of FRASES) casos.push({ modelo: m, voz: v, estilo: '', frase: f });
  // Estilo por instrução em texto (a vantagem dos personagens): as duas frases mais úteis.
  for (const f of [FRASES[0], FRASES[5]]) casos.push({ modelo: MODELOS[0], voz: 'Kore', estilo: ESTILO, frase: f });
  // Repetição da mesma frase: estabilidade da latência.
  for (let i = 0; i < 2; i++) casos.push({ modelo: MODELOS[0], voz: 'Kore', estilo: '', frase: FRASES[0], repeticao: i + 2 });
}
if (soStream) casos = [];

const pasta = 'relatorios/voz';
mkdirSync(join(pasta, 'audio'), { recursive: true });
const navegador = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await navegador.newPage();
await page.goto(BASE + '/wireframes/index.html'); // qualquer página do mesmo servidor serve: só precisa do import dos módulos

const medidas = [];
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- Gemini, modo unário ----------------
async function chamarGemini(c) {
  return page.evaluate(async ({ chave, c }) => {
    const m = await import('/src/tts/gemini.js');
    const corpo = m.montarPedido({ modelo: c.modelo, texto: c.frase.texto, voz: c.voz, estilo: c.estilo });
    const t0 = performance.now();
    let resp, t1, txt, t2;
    try {
      resp = await fetch(m.URL_INTERACTIONS, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': chave }, body: JSON.stringify(corpo) });
      t1 = performance.now(); txt = await resp.text(); t2 = performance.now();
    } catch (e) { return { erro: String(e).slice(0, 200) }; }
    let j = null; try { j = JSON.parse(txt); } catch (e) { /* corpo que não é JSON vai no campo erro abaixo */ }
    if (!resp.ok || !j) return { http: resp.status, erro: txt.slice(0, 300), cabecalhosMs: Math.round(t1 - t0), totalMs: Math.round(t2 - t0) };
    const b64 = m.extrairAudioBase64(j);
    if (!b64) return { http: resp.status, erro: 'sem áudio na resposta: ' + txt.slice(0, 200), totalMs: Math.round(t2 - t0) };
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const w = m.lerWav(bytes);
    const u = j.usage || {};
    return {
      http: resp.status, cabecalhosMs: Math.round(t1 - t0), totalMs: Math.round(t2 - t0),
      segundos: +w.segundos.toFixed(2), taxa: w.taxa, canais: w.canais, bits: w.bits, bytesAudio: bytes.length,
      usage: { entrada: u.total_input_tokens ?? null, entradaTexto: ((u.input_tokens_by_modality || []).find((x) => x.modality === 'text') || {}).tokens ?? null, saida: u.total_output_tokens ?? null, saidaAudio: ((u.output_tokens_by_modality || []).find((x) => x.modality === 'audio') || {}).tokens ?? null },
      b64,
    };
  }, { chave, c });
}

// ---------------- Kokoro local ----------------
async function chamarKokoro(f) {
  return page.evaluate(async ({ texto }) => {
    const t0 = performance.now();
    try {
      const resp = await fetch('http://127.0.0.1:8880/v1/audio/speech', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'kokoro', input: texto, voice: 'pf_dora', response_format: 'wav', speed: 0.95 }) });
      const t1 = performance.now();
      const buf = new Uint8Array(await resp.arrayBuffer());
      const t2 = performance.now();
      if (!resp.ok) return { http: resp.status, erro: new TextDecoder().decode(buf.slice(0, 200)) };
      const m = await import('/src/tts/gemini.js');
      const w = m.lerWav(buf);
      return { http: resp.status, cabecalhosMs: Math.round(t1 - t0), totalMs: Math.round(t2 - t0), segundos: +w.segundos.toFixed(2), taxa: w.taxa, bytesAudio: buf.length };
    } catch (e) { return { erro: String(e).slice(0, 200) }; }
  }, { texto: f.texto });
}

// ---------------- Gemini, streaming ----------------
// A resposta é SSE: blocos "event: nome\ndata: {json}" separados por linha em branco. O que interessa é quando
// chega o PRIMEIRO trecho de áudio (não o primeiro evento, que é só controle) e quanto áudio o total soma.
async function sondarStream(modelo, f) {
  return page.evaluate(async ({ chave, modelo, f }) => {
    const m = await import('/src/tts/gemini.js');
    const corpo = m.montarPedido({ modelo, texto: f.texto, voz: 'Kore', stream: true, formato: { mime_type: 'audio/l16', sample_rate: 24000 } });
    const t0 = performance.now();
    try {
      const resp = await fetch(m.URL_INTERACTIONS, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': chave }, body: JSON.stringify(corpo) });
      const tH = performance.now();
      if (!resp.ok) return { http: resp.status, erro: (await resp.text()).slice(0, 300), cabecalhosMs: Math.round(tH - t0) };
      const leitor = resp.body.getReader(), dec = new TextDecoder();
      let buf = '', eventos = 0, primeiroEvento = null, primeiroAudio = null, bytesAudio = 0, audios = 0, usage = null;
      const tipos = {}, exemplo = {};
      const tratar = (bloco) => {
        const nome = (bloco.match(/^event:\s*(.+)$/m) || [])[1] || '?';
        const dados = (bloco.match(/^data:\s*(.+)$/m) || [])[1];
        eventos++; tipos[nome] = (tipos[nome] || 0) + 1;
        if (primeiroEvento === null) primeiroEvento = Math.round(performance.now() - t0);
        let j = null; try { j = dados && JSON.parse(dados); } catch (e) { return; }
        if (!j) return;
        if (j.interaction && j.interaction.usage) usage = j.interaction.usage;
        if (j.usage) usage = j.usage;
        // Procura qualquer campo base64 de áudio, em qualquer profundidade, sem supor o nome do evento.
        const achar = (o) => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (k === 'data' && typeof v === 'string' && v.length > 40) { audios++; bytesAudio += Math.floor(v.length * 3 / 4); if (primeiroAudio === null) primeiroAudio = Math.round(performance.now() - t0); } else achar(v); } };
        achar(j);
        if (!exemplo[nome]) exemplo[nome] = JSON.stringify(j).replace(/"data":"[A-Za-z0-9+\/=]{40,}"/g, '"data":"<base64>"').slice(0, 260);
      };
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let i; while ((i = buf.indexOf('\n\n')) >= 0) { const b = buf.slice(0, i); buf = buf.slice(i + 2); if (b.trim()) tratar(b); }
      }
      if (buf.trim()) tratar(buf);
      const total = Math.round(performance.now() - t0);
      const segundos = bytesAudio / 2 / 24000; // l16: 16 bits, 24 kHz, mono
      return { http: resp.status, cabecalhosMs: Math.round(tH - t0), primeiroEventoMs: primeiroEvento, primeiroAudioMs: primeiroAudio, totalMs: total, eventos, trechosDeAudio: audios, bytesAudio, segundos: +segundos.toFixed(2), tipos, exemplo, usage: usage && { entrada: usage.total_input_tokens ?? null, saida: usage.total_output_tokens ?? null } };
    } catch (e) { return { erro: String(e).slice(0, 200) }; }
  }, { chave, modelo, f });
}

const custoDe = (modelo, r, texto) => {
  // Mesma regra do módulo: tokens de saída da API; entrada pelo total informado.
  const P = { 'gemini-3.8-flash-tts': [0.5, 9.0], 'gemini-3.8-flash-lite-tts': [0.5, 6.0] }[modelo];
  if (!P || !r.usage) return null;
  const tIn = r.usage.entrada ?? Math.ceil(texto.length / 4), tOut = r.usage.saida ?? Math.round(r.segundos * 25);
  const usd = (tIn / 1e6) * P[0] + (tOut / 1e6) * P[1]; // preços válidos até 31/12/2026
  return { usd: +usd.toFixed(6), brl: +(usd * CAMBIO).toFixed(5) };
};

// ---------------- execução ----------------
console.log(`Laboratório de voz: ${casos.length} chamadas ao Gemini${semKokoro ? '' : ' + Kokoro local'}. Isto gasta centavos reais.\n`);
let n = 0;
for (const c of casos) {
  n++;
  const rotulo = `${c.modelo.replace('gemini-', '')} ${c.voz}${c.estilo ? ' +estilo' : ''} ${c.frase.id}${c.repeticao ? ' #' + c.repeticao : ''}`;
  const r = await chamarGemini(c);
  const base = { motor: 'gemini', modelo: c.modelo, voz: c.voz, estilo: !!c.estilo, frase: c.frase.id, repeticao: c.repeticao || 1, chars: c.frase.texto.length };
  if (r.erro) { medidas.push({ ...base, ...r }); console.log(`${String(n).padStart(2)}/${casos.length} ${rotulo}: ERRO ${r.http || ''} ${r.erro}`); await pausa(1500); continue; }
  const { b64, ...resto } = r;
  const nomeArquivo = `${c.modelo.replace('gemini-', '')}_${c.voz}${c.estilo ? '_estilo' : ''}_${c.frase.id}${c.repeticao ? '_' + c.repeticao : ''}.wav`;
  writeFileSync(join(pasta, 'audio', nomeArquivo), Buffer.from(b64, 'base64'));
  const rtf = +(r.totalMs / 1000 / r.segundos).toFixed(2);
  medidas.push({ ...base, ...resto, arquivo: nomeArquivo, rtf, charsPorSegundo: +(base.chars / r.segundos).toFixed(1), custo: custoDe(c.modelo, r, c.frase.texto) });
  console.log(`${String(n).padStart(2)}/${casos.length} ${rotulo}: ${r.totalMs} ms para ${r.segundos} s de áudio (fator ${rtf}), ${r.usage.saida} tokens de saída`);
  await pausa(400);
}

if (!semKokoro) {
  console.log('\nKokoro local (pf_dora), mesmas frases:');
  for (const f of FRASES) {
    const r = await chamarKokoro(f);
    medidas.push({ motor: 'kokoro', modelo: 'kokoro (local)', voz: 'pf_dora', frase: f.id, chars: f.texto.length, ...r, rtf: r.segundos ? +(r.totalMs / 1000 / r.segundos).toFixed(2) : null, custo: { usd: 0, brl: 0 } });
    console.log(`  ${f.id}: ${r.erro ? 'ERRO ' + r.erro : `${r.totalMs} ms para ${r.segundos} s (fator ${medidas[medidas.length - 1].rtf})`}`);
  }
}

// Streaming: uma sonda por modelo na frase longa, que é onde ele mais importa.
const streams = [];
console.log('\nStreaming (sonda):');
for (const modelo of (rapido ? [MODELOS[1]] : MODELOS)) {
  const r = await sondarStream(modelo, FRASES[5]);
  streams.push({ modelo, ...r });
  console.log(`  ${modelo}: ${r.erro ? `ERRO ${r.http || ''} ${r.erro}` : `1º áudio em ${r.primeiroAudioMs} ms (1º evento em ${r.primeiroEventoMs} ms), total ${r.totalMs} ms, ${r.trechosDeAudio} trechos, ${r.segundos} s de áudio`}`);
  if (r.tipos) console.log(`    eventos: ${JSON.stringify(r.tipos)}`);
  await pausa(600);
}
await navegador.close();

// ---------------- resumo ----------------
const mediana = (v) => { const o = v.filter((x) => typeof x === 'number').sort((a, b) => a - b); if (!o.length) return null; const m = o.length >> 1; return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2); };
const grupos = new Map();
for (const m of medidas.filter((x) => !x.erro && x.segundos)) {
  const k = `${m.modelo} (${m.voz}${m.estilo ? ', com estilo' : ''})`;
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(m);
}
let md = `# Laboratório de voz (${new Date().toISOString().slice(0, 10)})\n\nChromium, mesma máquina, mesmas frases. Fator = tempo de geração dividido pela duração do áudio (abaixo de 1 gera mais rápido do que fala).\nCâmbio usado: R$ ${CAMBIO}. Preços do Gemini: página oficial em 06/10/2026, válidos até 31/12/2026 (sobem em 01/01/2027).\n\n| Motor, modelo, voz | Chamadas | Mediana (ms) | Pior (ms) | Fator mediano | Caracteres por segundo | Custo por chamada (R$) |\n|---|---|---|---|---|---|---|\n`;
for (const [k, v] of grupos) {
  const custos = v.map((x) => x.custo && x.custo.brl).filter((x) => typeof x === 'number');
  md += `| ${k} | ${v.length} | ${mediana(v.map((x) => x.totalMs))} | ${Math.max(...v.map((x) => x.totalMs))} | ${mediana(v.map((x) => Math.round(x.rtf * 100)))?.toString().replace(/^(\d+)(\d{2})$/, '$1,$2') ?? ''} | ${mediana(v.map((x) => Math.round(x.charsPorSegundo ?? (x.chars / x.segundos))))} | ${custos.length ? (custos.reduce((a, b) => a + b, 0) / custos.length).toFixed(4) : '0 (local)'} |\n`;
}
const gasto = medidas.reduce((a, m) => a + ((m.custo && m.custo.brl) || 0), 0);
md += `\nGasto total desta rodada: R$ ${gasto.toFixed(4)}.\n`;
if (streams.length) md += `\n## Streaming (sonda)\n\n` + streams.map((s) => `- ${s.modelo}: ${s.erro ? 'erro ' + (s.http || '') + ' ' + s.erro : `1º áudio em ${s.primeiroAudioMs} ms, total ${s.totalMs} ms, ${s.trechosDeAudio} trechos, ${s.segundos} s de áudio`}`).join('\n') + '\n';
const erros = medidas.filter((m) => m.erro);
if (erros.length) md += `\n## Erros (${erros.length})\n\n` + erros.slice(0, 10).map((e) => `- ${e.modelo} ${e.voz} ${e.frase}: HTTP ${e.http || '?'} ${e.erro}`).join('\n') + '\n';
writeFileSync(join(pasta, 'resumo.md'), md);
writeFileSync(join(pasta, 'telemetria.json'), JSON.stringify({ data: new Date().toISOString(), cambio: CAMBIO, medidas, streams }, null, 2));
console.log(`\n${md}\nRelatório: ${pasta}/resumo.md e ${pasta}/telemetria.json. Áudios em ${pasta}/audio/.`);
