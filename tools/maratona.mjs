// Teste de longa duração do quiosque (P9): sessões simuladas em sequência, medindo
// memória, FPS e erros ao longo de horas.
//
// Uso: python serve.py 8771 (em outro terminal) e depois
//   node tools/maratona.mjs [horas] [--real]
// Sem --real o Gemini é simulado e nenhuma chamada sai para a internet, então o
// teste não gasta orçamento. Com --real usa a chave do .env.local.
//
// Saída: relatorios/p9-maratona.json, com uma amostra por minuto, e um resumo no
// fim. Ctrl+C encerra e grava o que já mediu.
import { chromium } from '@playwright/test';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8771';
const horas = Number(process.argv[2]) || 4;
const real = process.argv.includes('--real');
const FIM = Date.now() + horas * 3600_000;
const DESTINO = 'relatorios/p9-maratona.json';

const PERGUNTAS = [
  'Por que o céu é azul?',
  'Quanto é 7 vezes 8?',
  'Me ensine uma palavra em inglês',
  'O que é fotossíntese?',
  'Quantos lados tem um hexágono?',
];
const RESPOSTA = 'O céu fica azul porque a luz azul se espalha mais no ar do que as outras cores.';

const chave = real && existsSync('.env.local')
  ? ((readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m) || [])[1] || '').trim()
  : '';

const args = process.platform === 'win32'
  ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const navegador = await chromium.launch({
  args: [...args, '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'],
});
const page = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
const cdp = await page.context().newCDPSession(page);

const erros = [];
page.on('pageerror', (e) => erros.push({ t: new Date().toISOString(), tipo: 'pageerror', msg: e.message }));
page.on('console', (m) => {
  if (m.type() === 'error') erros.push({ t: new Date().toISOString(), tipo: 'console', msg: m.text().slice(0, 300) });
});
page.on('crash', () => erros.push({ t: new Date().toISOString(), tipo: 'crash', msg: 'a aba morreu' }));

await page.addInitScript((k) => {
  localStorage.clear();
  localStorage.setItem('prof3d_personagem', 'luma');
  localStorage.setItem('prof3d_motor', 'webspeech');
  localStorage.setItem('prof3d_gemini_key', k || 'chave-falsa');
}, chave);

if (!chave) {
  // Gemini simulado: a resposta chega em pedaços, como no streaming de verdade.
  await page.route('**/generativelanguage.googleapis.com/**', (rota) => rota.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: RESPOSTA.split(' ').map((w, i, a) => `data: ${JSON.stringify({
      candidates: [{ content: { parts: [{ text: w + (i < a.length - 1 ? ' ' : '') }] } }],
      ...(i === a.length - 1 ? { usageMetadata: { promptTokenCount: 1800, candidatesTokenCount: 180 } } : {}),
    })}\r\n\r\n`).join(''),
  }));
}

await page.goto(BASE + '/?debug');
await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar), null, { timeout: 120_000 });

async function fps(segundos = 3) {
  return page.evaluate((s) => new Promise((ok) => {
    let n = 0; const ini = performance.now();
    const passo = () => { n++; if (performance.now() - ini < s * 1000) requestAnimationFrame(passo); else ok(+(n / s).toFixed(1)); };
    requestAnimationFrame(passo);
  }), segundos);
}

async function amostra(sessoes, perguntas) {
  await cdp.send('HeapProfiler.collectGarbage');
  const d = await page.evaluate(() => {
    const i = window.__prof3d.cena.renderer.info;
    return {
      heapMb: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      geometrias: i.memory.geometries,
      texturas: i.memory.textures,
      quadros: window.__prof3d.cena.quadros,
      contextoPerdido: window.__prof3d.cena.contextoPerdido,
      latencia: window.__prof3d.diagnostico.retrato({}).latencia,
      gasto: window.__prof3d.custo.resumo(),
      recargasDoVigia: Number(sessionStorage.getItem('prof3d_recargas') || 0),
    };
  });
  return {
    t: new Date().toISOString(),
    minuto: Math.round((Date.now() - inicio) / 60000),
    sessoes, perguntas,
    fps: await fps(),
    erros: erros.length,
    ...d,
  };
}

const inicio = Date.now();
const amostras = [];
let sessoes = 0, perguntas = 0, proximaAmostra = Date.now();

function gravar(status) {
  const heaps = amostras.map((a) => a.heapMb).filter((v) => v !== null);
  const fpss = amostras.map((a) => a.fps);
  const resumo = {
    status,
    comecou: new Date(inicio).toISOString(),
    terminou: new Date().toISOString(),
    horasPedidas: horas,
    horasRodadas: +((Date.now() - inicio) / 3600_000).toFixed(2),
    geminiReal: !!chave,
    sessoes, perguntas,
    erros: erros.length,
    listaDeErros: erros.slice(0, 50),
    heapMb: heaps.length ? { primeira: heaps[0], ultima: heaps[heaps.length - 1], maior: Math.max(...heaps), menor: Math.min(...heaps) } : null,
    fps: fpss.length ? { primeira: fpss[0], ultima: fpss[fpss.length - 1], menor: Math.min(...fpss), mediana: [...fpss].sort((a, b) => a - b)[fpss.length >> 1] } : null,
    geometrias: amostras.length ? { primeira: amostras[0].geometrias, ultima: amostras[amostras.length - 1].geometrias } : null,
    texturas: amostras.length ? { primeira: amostras[0].texturas, ultima: amostras[amostras.length - 1].texturas } : null,
    recargasDoVigia: amostras.length ? amostras[amostras.length - 1].recargasDoVigia : 0,
    amostras,
  };
  mkdirSync('relatorios', { recursive: true });
  writeFileSync(DESTINO, JSON.stringify(resumo, null, 2));
  return resumo;
}

let encerrando = false;
process.on('SIGINT', () => { encerrando = true; });

console.log(`Maratona de ${horas} h começando. Gemini ${chave ? 'REAL' : 'simulado'}. Ctrl+C encerra e grava.`);

// Uma sessão: começar, consentir por escrito, três perguntas, encerrar. Igual ao
// ciclo do evento, sem microfone nem câmera (não existem no navegador de teste).
while (Date.now() < FIM && !encerrando) {
  try {
    await page.evaluate(() => window.__prof3d.iniciarSessao('operador'));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__prof3d.irParaConversa('nao'));
    for (let i = 0; i < 3 && Date.now() < FIM && !encerrando; i++) {
      await page.fill('#text', PERGUNTAS[perguntas % PERGUNTAS.length]);
      await page.click('#form button[type=submit]');
      perguntas++;
      await page.waitForFunction(() => window.__prof3d.estado !== 'thinking', null, { timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
    await page.evaluate(() => window.__prof3d.encerrarSessao('operador'));
    await page.waitForTimeout(2000);
    sessoes++;

    // A cada 10 sessões, troca de personagem: é o caminho que mais mexe com memória.
    if (sessoes % 10 === 0) {
      const outros = await page.evaluate(() => window.__prof3d.disponiveis);
      const alvo = outros[sessoes / 10 % outros.length];
      await page.evaluate((id) => window.__prof3d.trocarPersonagem(window.__prof3d.buscarPersonagem(id)), alvo);
      // Esperar só por `avatar` não serve: ele ainda é o antigo nos primeiros milissegundos
      // da troca. A tela de carga sumir é o sinal de que o novo modelo está montado.
      await page.waitForTimeout(300);
      await page.waitForFunction(
        () => !!window.__prof3d.avatar && document.getElementById('loading').hidden,
        null, { timeout: 120_000 },
      );
    }
  } catch (e) {
    erros.push({ t: new Date().toISOString(), tipo: 'maratona', msg: String(e).slice(0, 300) });
    // A aba pode ter morrido; sem página não há o que medir.
    if (page.isClosed()) break;
  }

  if (Date.now() >= proximaAmostra) {
    proximaAmostra = Date.now() + 60_000;
    try {
      const a = await amostra(sessoes, perguntas);
      amostras.push(a);
      console.log(`${a.minuto} min | ${a.sessoes} sessões | ${a.perguntas} perguntas | ${a.fps} fps | ${a.heapMb} MB | ${a.geometrias} geo | ${a.erros} erros`);
      gravar('rodando');
    } catch (e) {
      erros.push({ t: new Date().toISOString(), tipo: 'amostra', msg: String(e).slice(0, 300) });
    }
  }
}

const resumo = gravar(encerrando ? 'interrompido' : 'completo');
await navegador.close();
console.log(`\nFim: ${resumo.horasRodadas} h, ${resumo.sessoes} sessões, ${resumo.perguntas} perguntas, ${resumo.erros} erros.`);
if (resumo.heapMb) console.log(`Heap: ${resumo.heapMb.primeira} MB no início, ${resumo.heapMb.ultima} MB no fim, máximo ${resumo.heapMb.maior} MB.`);
if (resumo.fps) console.log(`FPS: mediana ${resumo.fps.mediana}, mínimo ${resumo.fps.menor}.`);
console.log(`Relatório: ${DESTINO}`);
