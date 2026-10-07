// Importa MP3 pré-gravados (por exemplo exportados do NaturalReader) para assets/voz-importada/, indexados por hash de
// texto e voz (prompt 3, U4). O NaturalReader não tem API pública documentada: eu exporto os MP3 e este script os indexa.
//
//   node tools/importar-voz.mjs adicionar --voz <rotulo> --texto "Frase exata" --arquivo caminho.mp3 [--origem "NaturalReader, voz X"]
//   node tools/importar-voz.mjs lote --voz <rotulo> --lista lista.json --pasta <pasta-com-os-mp3>
//        lista.json = [{ "texto": "Frase", "arquivo": "01.mp3" }, ...]   (arquivo relativo a --pasta)
//   node tools/importar-voz.mjs listar
//
// A pasta assets/voz-importada/ está no .gitignore: a licença do áudio exportado é de quem exportou, e o repositório é público.
// A chave do arquivo é sha256("<voz>|<texto sem espaços repetidos>"), a mesma de src/tts/importado.js.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';

const PASTA = 'assets/voz-importada';
const MANIFEST = join(PASTA, 'manifest.json');
const norm = (t) => String(t).replace(/\s+/g, ' ').trim();
const hash = (voz, texto) => createHash('sha256').update(`${voz}|${norm(texto)}`).digest('hex');
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };

const manifesto = () => (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { itens: [] });
function adicionar(m, { voz, texto, arquivo, origem }) {
  if (!existsSync(arquivo)) throw new Error(`Arquivo não existe: ${arquivo}`);
  if (!/\.mp3$/i.test(arquivo)) throw new Error(`Só MP3: ${arquivo}`);
  if (statSync(arquivo).size > 5e6) throw new Error(`MP3 maior que 5 MB, confira se é uma frase: ${arquivo}`);
  if (texto.includes('—')) throw new Error('Travessão no texto da frase: troque por vírgula ou ponto.');
  const h = hash(voz, texto);
  const nome = `${h.slice(0, 16)}.mp3`;
  mkdirSync(PASTA, { recursive: true });
  copyFileSync(arquivo, join(PASTA, nome));
  const item = { hash: h, voz, texto: norm(texto), arquivo: nome, origem: origem || '', original: basename(arquivo), importadoEm: new Date().toISOString().slice(0, 10) };
  const i = m.itens.findIndex((x) => x.hash === h);
  if (i >= 0) m.itens[i] = item; else m.itens.push(item);
  return item;
}

const cmd = process.argv[2];
if (cmd === 'listar') {
  const m = manifesto();
  for (const i of m.itens) console.log(`${i.voz} | ${i.texto.slice(0, 60)} | ${i.arquivo}`);
  console.log(`${m.itens.length} arquivo(s).`);
} else if (cmd === 'adicionar' || cmd === 'lote') {
  const voz = arg('voz');
  if (!voz) { console.error('Informe --voz (o rótulo da voz, ex.: "naturalreader-camila").'); process.exit(2); }
  const m = manifesto();
  try {
    if (cmd === 'adicionar') {
      const texto = arg('texto'), arquivo = arg('arquivo');
      if (!texto || !arquivo) { console.error('Informe --texto e --arquivo.'); process.exit(2); }
      adicionar(m, { voz, texto, arquivo, origem: arg('origem') });
      console.log('1 arquivo importado.');
    } else {
      const lista = JSON.parse(readFileSync(arg('lista'), 'utf8')), pasta = arg('pasta') || '.';
      for (const it of lista) adicionar(m, { voz, texto: it.texto, arquivo: join(pasta, it.arquivo), origem: arg('origem') });
      console.log(`${lista.length} arquivo(s) importado(s).`);
    }
  } catch (e) { console.error(e.message); process.exit(1); }
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
} else {
  console.error('Uso: adicionar | lote | listar (veja o cabeçalho do arquivo).'); process.exit(2);
}
