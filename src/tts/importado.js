// Motor "arquivo importado" (prompt 3, U4): MP3 pré-gravado fora do app (por exemplo exportado do NaturalReader) e indexado
// por hash de texto e voz. NÃO sintetiza nada: só toca o que o operador importou com `node tools/importar-voz.mjs`.
// O NaturalReader não tem API pública documentada no site oficial (conferido em 07/10/2026: sem página de desenvolvedor),
// então ele entra só por aqui. A pasta assets/voz-importada/ fica FORA do git: a licença do áudio exportado é do dono.
//
// Chave: sha256("<voz>|<texto normalizado>"). A normalização (aparar e juntar espaços) é a mesma da ferramenta.
export const PASTA_IMPORTADA = 'assets/voz-importada/';

export const normalizarTextoImportado = (t) => String(t).replace(/\s+/g, ' ').trim();

export async function hashImportado(voz, texto) {
  const dados = new TextEncoder().encode(`${voz}|${normalizarTextoImportado(texto)}`);
  const buf = await crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function criarImportado({ base = PASTA_IMPORTADA } = {}) {
  let indice = null; // Map hash -> item
  async function carregar() {
    if (indice) return indice;
    indice = new Map();
    try {
      const r = await fetch(base + 'manifest.json', { cache: 'no-store' });
      if (r.ok) for (const it of (await r.json()).itens || []) indice.set(it.hash, it);
    } catch (e) { console.warn('[voz-importada] sem manifest:', e); }
    return indice;
  }
  return {
    id: 'importado',
    nome: 'Áudio importado (MP3 pré-gravado)',
    direto: false,
    suportaVoz() { return true },
    recarregar() { indice = null; },
    async quantos() { return (await carregar()).size; },
    // voz.importado = { rotulo }. Falta de arquivo é erro claro: o app cai no próximo motor da cadeia.
    async sintetizar(texto, voz, { signal, ctx, aoMedir }) {
      const rotulo = voz && voz.importado && voz.importado.rotulo;
      if (!rotulo) throw Object.assign(new Error('Falta o rótulo da voz importada.'), { status: 0 });
      const t0 = performance.now();
      const item = (await carregar()).get(await hashImportado(rotulo, texto));
      if (!item) throw Object.assign(new Error(`Sem MP3 importado para esta frase na voz "${rotulo}".`), { status: 404 });
      const r = await fetch(base + item.arquivo, { signal });
      if (!r.ok) throw Object.assign(new Error(`MP3 importado não abriu: HTTP ${r.status}`), { status: r.status });
      const buf = await ctx.decodeAudioData(await r.arrayBuffer());
      if (aoMedir) aoMedir({ ms: performance.now() - t0, msCabecalho: performance.now() - t0, caracteres: texto.length, usd: 0 });
      return buf;
    },
  };
}
