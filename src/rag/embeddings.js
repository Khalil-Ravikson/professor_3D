// Embeddings locais do RAG (prompt 2, R4). Modelo multilíngue E5 pequeno, rodando no navegador com transformers.js.
//
// Modelo: Xenova/multilingual-e5-small (Hugging Face), 384 dimensões, até 512 tokens, ONNX quantizado de 118 MB
// (model_quantized.onnx, conferido na página do modelo em 07/10/2026). Baixa uma vez no navegador de quem usa a base e
// fica no cache do próprio transformers.js. O E5 exige prefixos: "query: " na pergunta e "passage: " no documento,
// pooling por média e normalização L2 (REPERTORIO 16).
// Trocar de modelo, dimensão ou prefixo muda o vetor: o índice é refeito inteiro (a chave de src/rag/rag.js inclui o id).
// NÃO TESTADO: o modelo não foi baixado nem executado nesta sessão (testes adiados a pedido do dono).

// A mesma versão fixa que src/ouvido.js usa para o Whisper: uma biblioteca só na CDN.
import { carregarTransformers } from '../transformers-local.js';
export const MODELO_EMB = 'Xenova/multilingual-e5-small';
export const DIM = 384;
export const TAMANHO_DOWNLOAD_MB = 118;

// O modelo já está no cache do navegador (o operador já aceitou o download uma vez)? Então preparar a base não baixa nada.
// O transformers.js guarda os arquivos na Cache Storage "transformers-cache".
export async function modeloEmCache() {
  try {
    if (typeof caches === 'undefined') return false;
    const c = await caches.open('transformers-cache');
    return (await c.keys()).some((r) => r.url.includes('multilingual-e5-small') && r.url.endsWith('model_quantized.onnx'));
  } catch (e) {
    console.warn('[rag] não consegui olhar o cache do modelo:', e);
    return false;
  }
}
const LOTE = 4;

export function criarEmbeddings({ aoProgresso = () => {} } = {}) {
  let extrator = null, carregando = null;

  async function carregar() {
    if (extrator) return extrator;
    if (!carregando) {
      carregando = (async () => {
        const { pipeline } = await carregarTransformers();
        extrator = await pipeline('feature-extraction', MODELO_EMB, {
          dtype: 'q8', // model_quantized.onnx
          progress_callback: (p) => { if (p.status === 'progress' && typeof p.progress === 'number') aoProgresso(Math.round(p.progress)); },
        });
        return extrator;
      })().catch((e) => { carregando = null; throw e; });
    }
    return carregando;
  }

  async function vetores(textos, prefixo) {
    const ext = await carregar();
    const saida = [];
    for (let i = 0; i < textos.length; i += LOTE) {
      const lote = textos.slice(i, i + LOTE).map((t) => prefixo + t);
      const tensor = await ext(lote, { pooling: 'mean', normalize: true });
      for (const v of tensor.tolist()) saida.push(Float32Array.from(v));
    }
    return saida;
  }

  return {
    get carregado() { return !!extrator; },
    carregar,
    passagens: (textos) => vetores(textos, 'passage: '),
    async consulta(texto) { return (await vetores([texto], 'query: '))[0]; },
  };
}
