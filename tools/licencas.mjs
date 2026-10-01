// Verificação de licenças: modelos (.vrm), clipes (catálogo) e dependências (CDN e package.json).
// Uso: node tools/licencas.mjs
// Saída: THIRD-PARTY.md e relatorios/licencas.json. Termina com código 1 se algo estiver bloqueado,
// se houver dependência AGPL/GPL ou de licença desconhecida, ou se um arquivo proibido estiver no git.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { avaliarLicenca, licencaDependenciaProblematica } from '../src/licenca.js';

const problemas = [];

// ---------- Modelos ----------
function metaDoVrm(caminho) {
  const b = readFileSync(caminho);
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  const e = json.extensions || {};
  if (e.VRMC_vrm) return { meta: e.VRMC_vrm.meta, versao: '1' };
  if (e.VRM) return { meta: e.VRM.meta, versao: '0' };
  return { meta: null, versao: null };
}
const modelos = readdirSync('assets/avatars').filter((f) => f.endsWith('.vrm')).map((f) => {
  const { meta, versao } = metaDoVrm('assets/avatars/' + f);
  const r = avaliarLicenca(meta, { versao });
  if (r.decisao === 'bloqueado') problemas.push(`modelo ${f}: ${r.bloqueio.join('; ')}`);
  return { arquivo: f, ...r };
});

// ---------- Clipes ----------
const catalogo = JSON.parse(readFileSync('assets/animations/animacoes.json', 'utf8'));
const clipes = catalogo.clipes.map((c) => ({
  id: c.id, arquivo: c.arquivo, origem: c.origem, licenca: c.licenca, status: c.status,
  presente: existsSync(c.arquivo),
  noRepositorio: false,
}));
// Arquivos que não podem ir para o repositório público (pacote VRoid, Mixamo, segredos).
const rastreados = execSync('git ls-files', { encoding: 'utf8' }).split('\n');
const PROIBIDOS = [/^VRMA_MotionPack\//, /\.fbx$/i, /aceno[^/]*\.vrma$/i, /(^|\/)\.env/];
for (const f of rastreados) if (PROIBIDOS.some((re) => re.test(f))) problemas.push(`arquivo proibido no git: ${f}`);
for (const c of clipes) c.noRepositorio = rastreados.includes(c.arquivo);

// ---------- Dependências ----------
function versaoLicenca(pkg, versao) {
  try {
    return execSync(`npm view ${pkg}@${versao} license`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return '';
  }
}
const fontesCodigo = ['index.html', 'comparar-lipsync.html', ...readdirSync('src', { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => 'src/' + f.replaceAll('\\', '/'))];
const cdn = new Map();
for (const f of fontesCodigo) {
  const t = readFileSync(f, 'utf8');
  for (const m of t.matchAll(/https:\/\/(?:cdn\.jsdelivr\.net\/npm|unpkg\.com|esm\.sh)\/((?:@[^/@]+\/)?[^/@'"]+)@([0-9][^/'" ]*)/g)) cdn.set(`${m[1]}@${m[2]}`, { pkg: m[1], versao: m[2], uso: 'navegador (CDN)' });
}
const pj = JSON.parse(readFileSync('package.json', 'utf8'));
for (const [pkg, v] of Object.entries(pj.dependencies || {})) cdn.set(`${pkg}@${v}`, { pkg, versao: v, uso: 'dependência' });
for (const [pkg, v] of Object.entries(pj.devDependencies || {})) cdn.set(`${pkg}@${v}`, { pkg, versao: v, uso: 'só testes' });

const deps = [];
for (const d of cdn.values()) {
  const licenca = versaoLicenca(d.pkg, d.versao);
  const alerta = licencaDependenciaProblematica(licenca);
  if (alerta) problemas.push(`dependência ${d.pkg}@${d.versao}: ${alerta}`);
  deps.push({ ...d, licenca, alerta });
}
// Fontes do Google Fonts (não são pacotes npm): licença conferida no Google Fonts.
const FONTES = [
  ['Atkinson Hyperlegible', 'OFL-1.1'], ['Baloo 2', 'OFL-1.1'], ['JetBrains Mono', 'OFL-1.1'],
];
const vendor = [
  ['src/vendor/mixamo (exemplo do three-vrm v3.5.5)', 'MIT, pixiv Inc.'],
  ['assets/mediapipe/face_landmarker.task (modelo do MediaPipe)', 'Apache-2.0'],
];
// Dependências que vêm dentro dos bundles de CDN (um nível, conferido com npm view em 01/10/2026).
const indiretas = [
  ['onnxruntime-web', '1.22.0-dev', '@huggingface/transformers', 'MIT', ''],
  ['@huggingface/jinja', '0.5.3', '@huggingface/transformers', 'MIT', ''],
  ['phonemizer', '1.2.1', 'kokoro-js', 'Apache-2.0 (declarada)',
    'usa o eSpeak NG, que é GPL-3.0. Só entra no motor opcional "Kokoro no navegador" (inglês). Conferir antes de publicar com esse motor ligado'],
];
const avisos = indiretas.filter((d) => d[4]).map((d) => `${d[0]}@${d[1]} (via ${d[2]}): ${d[4]}`);

// ---------- Saída ----------
const linha = (cels) => `| ${cels.join(' | ')} |`;
const md = [
  '# Licenças de terceiros',
  '',
  'Gerado por `node tools/licencas.mjs`. Não edite à mão: rode o script de novo.',
  '',
  '## Dependências de código',
  '',
  linha(['Pacote', 'Versão', 'Uso', 'Licença', 'Alerta']), linha(['---', '---', '---', '---', '---']),
  ...deps.sort((a, b) => a.pkg.localeCompare(b.pkg)).map((d) => linha([d.pkg, d.versao, d.uso, d.licenca || '?', d.alerta || ''])),
  ...vendor.map(([n, l]) => linha([n, '', 'copiado no código', l, ''])),
  '',
  '## Dependências dentro dos bundles (um nível)',
  '',
  linha(['Pacote', 'Versão', 'Vem de', 'Licença', 'Aviso']), linha(['---', '---', '---', '---', '---']),
  ...indiretas.map((d) => linha(d)),
  '',
  '## Fontes',
  '',
  linha(['Fonte', 'Licença']), linha(['---', '---']),
  ...FONTES.map(([n, l]) => linha([n, l])),
  '',
  '## Modelos (.vrm), lidos dos metadados',
  '',
  linha(['Arquivo', 'Título', 'Autor', 'VRM', 'Licença', 'Decisão', 'Motivos']), linha(['---', '---', '---', '---', '---', '---', '---']),
  ...modelos.map((m) => linha([m.arquivo, m.titulo, m.autor, m.versao, m.licenca, m.decisao, [...m.bloqueio, ...m.conferir].join('; ')])),
  '',
  '## Clipes de animação',
  '',
  'Pacote VRoid e arquivos do Mixamo ficam fora do repositório (`.gitignore`). Frase de crédito do pacote VRoid: "Animation credits to pixiv Inc.\'s VRoid Project".',
  '',
  linha(['id', 'Arquivo', 'Origem', 'Licença', 'No repositório']), linha(['---', '---', '---', '---', '---']),
  ...clipes.map((c) => linha([c.id, c.arquivo, c.origem, c.licenca, c.noRepositorio ? 'sim' : 'não'])),
  '',
  avisos.length ? '## Avisos (não bloqueiam)\n\n' + avisos.map((a) => '- ' + a).join('\n') + '\n' : '',
  problemas.length ? '## Problemas\n\n' + problemas.map((p) => '- ' + p).join('\n') : 'Nenhum problema encontrado.',
  '',
].join('\n');
writeFileSync('THIRD-PARTY.md', md);
mkdirSync('relatorios', { recursive: true });
writeFileSync('relatorios/licencas.json', JSON.stringify({ modelos, clipes, deps, indiretas, avisos, problemas }, null, 2));
if (avisos.length) console.log('AVISOS:\n' + avisos.join('\n'));
console.log(problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : `ok: ${modelos.length} modelos, ${clipes.length} clipes, ${deps.length} dependências`);
process.exitCode = problemas.length ? 1 : 0;
