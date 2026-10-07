// transformers.js hospedado em assets/vendor/transformers/ (3.8.1, ver assets/vendor/CREDITS.md). Um só carregador para o
// Whisper (ouvido.js) e para os embeddings do RAG, para o runtime ONNX (wasm) vir da mesma pasta e não da CDN.
// Os PESOS dos modelos (Whisper, E5) continuam vindo do Hugging Face na primeira vez e ficam no cache do navegador.
const BASE = new URL('assets/vendor/transformers/', location.href).href;
let carregado = null;

export function carregarTransformers() {
  if (!carregado) {
    carregado = import(BASE + 'transformers.min.js').then((tf) => {
      tf.env.backends.onnx.wasm.wasmPaths = BASE; // senão ele procura o ort-wasm na jsDelivr
      return tf;
    }).catch((e) => { carregado = null; throw e; });
  }
  return carregado;
}
