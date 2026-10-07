// Orquestra o RAG de um personagem (prompt 2, R4): lê knowledge/<id>/, indexa só o que mudou, consulta com limiar.
// Nada aqui inventa conteúdo: sem manifest.json (ou com a pasta vazia) o personagem segue sem base e responde como sempre.
import { operar } from '../banco.js';
import { lerDocumento, dividirEmTrechos, textoParaVetor, VERSAO_CHUNKER } from './chunker.js';
import { buscar, semAcento, LIMIAR_PADRAO } from './busca.js';
import { MODELO_EMB } from './embeddings.js';

const LOJA = 'rag';
const PREFIXOS = 'e5-query-passage-v1';

async function hashHex(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Chave do índice: conteúdo + modelo + versão do chunker + prefixos. Mudou qualquer parte, reindexa só aquele arquivo.
export const chaveDoIndice = (hash) => `${hash}|${MODELO_EMB}|${VERSAO_CHUNKER}|${PREFIXOS}`;

export function criarRag({ embeddings, aoStatus = () => {}, raiz = 'knowledge' } = {}) {
  const manifestos = new Map(); // personagemId -> { arquivos: [...] } | null
  const memoria = new Map();    // personagemId -> trechos com vetor, só depois de pronto
  const estado = new Map();     // personagemId -> { documentos, indexados, pendentes }
  let limiar = LIMIAR_PADRAO;

  const registros = async (pid) => {
    const todos = (await operar(LOJA, 'readonly', (l) => l.getAll())) || [];
    return todos.filter((r) => r.personagemId === pid);
  };

  // knowledge/index.json (gerado por tools/knowledge.mjs) diz quais personagens têm documentos. O arquivo sempre existe,
  // então um personagem sem base não gera pedido 404 nem erro no console.
  let listaCache = null;
  async function lerLista() {
    if (listaCache) return listaCache;
    try {
      const resp = await fetch(`${raiz}/index.json`);
      listaCache = resp.ok ? await resp.json() : {};
    } catch (e) {
      console.warn('[rag] index.json não abriu:', e);
      listaCache = {};
    }
    return listaCache;
  }
  async function lerManifesto(pid) {
    const arquivos = ((await lerLista()).personagens || {})[pid];
    return Array.isArray(arquivos) && arquivos.length ? { arquivos } : null;
  }

  // Quais arquivos já estão indexados com a chave atual? Não baixa o modelo.
  async function verificar(pid) {
    const m = await lerManifesto(pid);
    manifestos.set(pid, m);
    if (!m) { estado.set(pid, { documentos: 0, indexados: 0, pendentes: [] }); memoria.delete(pid); return estado.get(pid); }
    const guardados = new Map((await registros(pid)).map((r) => [r.arquivo, r]));
    const pendentes = [];
    for (const arq of m.arquivos) {
      let texto;
      try { texto = await (await fetch(`${raiz}/${pid}/${arq}`)).text(); } catch (e) { console.warn(`[rag] ${arq} não abriu:`, e); pendentes.push(arq); continue; }
      const reg = guardados.get(arq);
      if (!reg || reg.chave !== chaveDoIndice(await hashHex(texto))) pendentes.push(arq);
    }
    const e = { documentos: m.arquivos.length, indexados: m.arquivos.length - pendentes.length, pendentes };
    estado.set(pid, e);
    if (!pendentes.length) memoria.set(pid, (await registros(pid)).filter((r) => m.arquivos.includes(r.arquivo)).flatMap((r) => r.trechos.map((t) => ({ ...t, fonte: r.fonte, licenca: r.licenca }))));
    else memoria.delete(pid);
    return e;
  }

  // Indexa só os pendentes. Documento sem fonte ou licença é recusado e fica fora do índice.
  async function preparar(pid, aoProgresso = () => {}) {
    const e0 = await verificar(pid);
    if (!e0.documentos) return { ok: false, motivo: 'sem documentos' };
    const recusados = [];
    let feitos = 0;
    for (const arq of e0.pendentes) {
      const texto = await (await fetch(`${raiz}/${pid}/${arq}`)).text();
      const doc = lerDocumento(texto);
      if (doc.erros.length) { recusados.push({ arquivo: arq, erros: doc.erros }); continue; }
      const trechos = dividirEmTrechos(doc, arq);
      const vetores = await embeddings.passagens(trechos.map(textoParaVetor));
      const reg = {
        id: `${pid}|${arq}`, personagemId: pid, arquivo: arq, chave: chaveDoIndice(await hashHex(texto)), fonte: doc.fonte, licenca: doc.licenca,
        trechos: trechos.map((t, i) => ({ ...t, vetor: vetores[i] })),
      };
      await operar(LOJA, 'readwrite', (l) => l.put(reg));
      aoProgresso(++feitos, e0.pendentes.length);
    }
    // Arquivos que saíram da pasta saem do índice.
    const m = manifestos.get(pid);
    for (const r of await registros(pid)) if (!m.arquivos.includes(r.arquivo)) await operar(LOJA, 'readwrite', (l) => l.delete(r.id));
    await verificar(pid);
    return { ok: true, indexados: feitos, recusados };
  }

  async function apagar(pid) {
    for (const r of await registros(pid)) await operar(LOJA, 'readwrite', (l) => l.delete(r.id));
    memoria.delete(pid);
    await verificar(pid);
  }

  return {
    verificar, preparar, apagar,
    // A pergunta cita um termo do assunto da base? O padrão vem pronto do index.json (tools/knowledge.mjs), derivado dos documentos.
    async ehDoTema(pid, pergunta) {
      const tema = ((await lerLista()).temas || {})[pid];
      if (!tema || !tema.padrao) return false;
      return new RegExp(tema.padrao, 'i').test(semAcento(pergunta));
    },
    // Depois de mudar documentos e rodar tools/knowledge.mjs: relê a lista na próxima verificação.
    esquecerLista() { listaCache = null; },
    estado: (pid) => estado.get(pid) || { documentos: 0, indexados: 0, pendentes: [] },
    // Só consulta quando o índice atual está completo e em memória.
    pronto: (pid) => memoria.has(pid),
    definirLimiar(v) { limiar = Number(v) || LIMIAR_PADRAO; },
    get limiar() { return limiar; },
    async consultar(pid, pergunta, { k = 4 } = {}) {
      const trechos = memoria.get(pid);
      if (!trechos) return null;
      const vetorConsulta = await embeddings.consulta(pergunta);
      return buscar({ consulta: pergunta, vetorConsulta, trechos, k, limiar });
    },
  };
}
