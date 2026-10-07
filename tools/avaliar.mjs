// Avaliação completa do projeto em um comando só (P10).
//
// Uso: npm run avaliar  (ou node tools/avaliar.mjs [--rapido])
//
// Roda, nesta ordem: detector anti-slop, testes unitários, licenças, testes de
// animação e de quiosque com as capturas dos quadros-chave, e o relatório de
// desempenho. Sobe o servidor em 8771 se ninguém estiver atendendo, e devolve
// código 1 se qualquer etapa falhar.
//
// --rapido pula a medição de desempenho, que é a parte lenta e que gasta
// perguntas da chave do Gemini.
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createConnection } from 'node:net';

const rapido = process.argv.includes('--rapido');
const PORTA = 8771;
const BASE = `http://localhost:${PORTA}`;

function atendendo(porta) {
  return new Promise((ok) => {
    const s = createConnection({ port: porta, host: '127.0.0.1' }, () => { s.end(); ok(true); });
    s.on('error', () => ok(false));
    s.setTimeout(700, () => { s.destroy(); ok(false); });
  });
}

async function esperarServidor(tentativas = 25) {
  for (let i = 0; i < tentativas; i++) {
    if (await atendendo(PORTA)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// npx e npm são .cmd no Windows, e aí só rodam com shell.
const shell = process.platform === 'win32';
function rodar(comando, args, { aceitaFalha = false } = {}) {
  const t0 = Date.now();
  const r = spawnSync(comando, args, { stdio: 'inherit', shell });
  return {
    ok: aceitaFalha ? true : r.status === 0,
    codigo: r.status,
    segundos: +((Date.now() - t0) / 1000).toFixed(1),
  };
}

const etapas = [];
function etapa(nome, oQueProva, fn) {
  console.log(`\n${'='.repeat(70)}\n${nome}\n${'='.repeat(70)}`);
  let r;
  try {
    r = fn();
  } catch (e) {
    r = { ok: false, codigo: null, segundos: 0, erro: String(e).slice(0, 300) };
  }
  etapas.push({ nome, oQueProva, ...r });
  console.log(`${r.ok ? 'OK' : 'FALHOU'}: ${nome} (${r.segundos}s)`);
  return r.ok;
}

let servidorNosso = null;
if (!(await atendendo(PORTA))) {
  console.log(`Ninguém atende em ${PORTA}; subindo o servidor.`);
  servidorNosso = spawn('python', ['serve.py', String(PORTA)], { stdio: 'ignore', detached: false });
  if (!(await esperarServidor())) {
    console.error(`O servidor não subiu em ${PORTA}. Rode "python serve.py ${PORTA}" à mão e tente de novo.`);
    process.exit(1);
  }
} else {
  console.log(`Já tem alguém atendendo em ${PORTA}; vou usar esse.`);
}

const inicio = Date.now();

etapa('Detector anti-slop', 'nenhum padrão de interface genérica no HTML e no JS',
  () => rodar('npx', ['impeccable', 'detect', 'index.html', 'src', '--json']));

etapa('Testes unitários', 'frases, gestos, quadro, câmera, licença, áudio, vigia, custo e contraste',
  () => rodar('node', ['--test', '--test-force-exit', 'tests/unit/*.test.js']));

etapa('Política de segurança (CSP)', 'o hash do importmap na Content-Security-Policy confere com o index.html',
  () => rodar('node', ['tools/csp.mjs', '--verificar']));

etapa('Banco de perguntas e detector de frases proibidas', '20 perguntas por personagem e o detector pegando o que promete (sem chamar o Gemini; as respostas reais exigem --gastar em avaliar-respostas)',
  () => rodar('node', ['tools/avaliar-respostas.mjs']));

etapa('Licenças', 'modelos, clipes e dependências; falha com AGPL, GPL, licença desconhecida ou arquivo proibido no git',
  () => rodar('node', ['tools/licencas.mjs']));

etapa('Animação e gestos', 'máquina de estados, gesto que não corta sentença, pedido inválido ignorado, capturas dos quadros-chave',
  () => rodar('npx', ['playwright', 'test', 'tests/e2e/p3-gestos.spec.js', 'tests/e2e/p1-galeria.spec.js']));

etapa('Vitrine e seleção de personagem', 'ciclo sem som, retorno por inatividade, roleta, pódio, perfil, troca por clique, seta, teclado e deslize, retratos em cache, 20 trocas sem vazar memória e Ouvir voz sem chamada de rede',
  () => rodar('npx', ['playwright', 'test', 'tests/e2e/p11-selecao.spec.js', 'tests/e2e/p11-vitrine.spec.js']));

etapa('Sessão e fluxo', 'cumprimento, conversa, despedida e as etapas em retrato e paisagem',
  () => rodar('npx', ['playwright', 'test', 'tests/e2e/p4-sessao.spec.js', 'tests/e2e/p5-fluxo.spec.js']));

etapa('Áudio, quiosque e acessibilidade', 'volume, intervalo entre frases, queda de contexto WebGL, vigia, diagnóstico, alvos de toque e foco',
  () => rodar('npx', ['playwright', 'test', 'tests/e2e/p8-audio.spec.js', 'tests/e2e/p9-quiosque.spec.js', 'tests/e2e/p9-acessibilidade.spec.js']));

etapa('Nivelamento de áudio', 'volume dos arquivos de amostra antes e depois',
  () => rodar('node', ['tools/medir-audio.mjs']));

if (!rapido) {
  etapa('Desempenho', 'carga, FPS em repouso, tempo até a primeira fala e memória depois de 10 trocas',
    () => rodar('node', ['tools/medir.mjs', 'avaliacao']));
} else {
  etapas.push({ nome: 'Desempenho', oQueProva: 'pulado por --rapido', ok: true, pulado: true, segundos: 0 });
}

if (servidorNosso) servidorNosso.kill();

const capturas = existsSync('relatorios') ? readdirSync('relatorios').filter((f) => f.endsWith('.png')) : [];
const falhas = etapas.filter((e) => !e.ok);
const relatorio = {
  data: new Date().toISOString(),
  segundos: +((Date.now() - inicio) / 1000).toFixed(1),
  modo: rapido ? 'rapido' : 'completo',
  etapas,
  capturas: capturas.length,
  resultado: falhas.length ? 'falhou' : 'passou',
};
mkdirSync('relatorios', { recursive: true });
writeFileSync('relatorios/avaliacao.json', JSON.stringify(relatorio, null, 2));

console.log(`\n${'='.repeat(70)}\nRESUMO\n${'='.repeat(70)}`);
for (const e of etapas) console.log(`${e.pulado ? 'pulado ' : e.ok ? 'ok     ' : 'FALHOU '} ${String(e.segundos).padStart(6)}s  ${e.nome}`);
console.log(`\n${capturas.length} capturas em relatorios/. Relatório: relatorios/avaliacao.json`);
console.log(falhas.length ? `\n${falhas.length} etapa(s) falharam: ${falhas.map((f) => f.nome).join(', ')}` : '\nTudo passou.');
process.exit(falhas.length ? 1 : 0);
