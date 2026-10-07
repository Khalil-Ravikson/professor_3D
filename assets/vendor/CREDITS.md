# Bibliotecas hospedadas (assets/vendor)

Hospedadas aqui, e não na CDN, para o app abrir sem internet. Versões fixas, baixadas da jsDelivr em 07/10/2026 com autorização do dono.
Os tamanhos conferem com a listagem de arquivos da própria jsDelivr (API de dados, só metadados). Troque uma versão baixando de novo
o mesmo caminho e subindo `CDN` em `sw.js` (o service worker guarda esta pasta no cache `p3d-cdn`).

| Pasta | Origem (https://cdn.jsdelivr.net/npm/...) | Licença (campo `license` do npm, 07/10/2026) | Tamanho |
|---|---|---|---|
| `three/build/` (`three.module.js`, `three.core.js`) | `three@0.180.0/build/` | MIT (cabeçalho nos arquivos) | 603 KB e 1,40 MB |
| `three/examples/jsm/` (OrbitControls, GLTFLoader, FBXLoader, BufferGeometryUtils, libs/fflate.module, curves/NURBSCurve e NURBSUtils) | `three@0.180.0/examples/jsm/` | MIT | 397 KB no total |
| `three-vrm/three-vrm.module.min.js` | `@pixiv/three-vrm@3.5.5/lib/` | MIT (cabeçalho aponta para o LICENSE do pixiv) | 155 KB |
| `three-vrm/three-vrm-animation.module.min.js` | `@pixiv/three-vrm-animation@3.5.5/lib/` | MIT | 34 KB |
| `wlipsync/` (`wlipsync.js`, `audio-processor.js`, `wlipsync.wasm`) | `wlipsync@1.3.1/dist/` | MIT | 2,2 KB, 2,2 KB e 12,1 KB |
| `mathjs/mathjs.esm.js` | `mathjs@15.2.0/+esm` (empacotado pela jsDelivr com Rollup e esbuild) | Apache-2.0 | 666 KB |
| `mathjs/deps/` | os 10 arquivos `+esm` que o mathjs importa: typed-function 4.2.2, decimal.js 10.6.0, complex.js 2.4.3, fraction.js 5.3.4, seedrandom 3.0.5, tiny-emitter 2.1.0, javascript-natural-sort 0.7.1, escape-latex 1.2.0, @babel/runtime 7.29.2 (helpers `extends` e `defineProperty`) | todas MIT | cerca de 80 KB no total |

| `mediapipe/` (`vision_bundle.mjs`, `wasm/vision_wasm_internal.js`, `wasm/vision_wasm_internal.wasm`) | `@mediapipe/tasks-vision@1.0.1/` (só a variante com SIMD; a sem SIMD, 11,3 MB, não foi baixada) | Apache-2.0 | 155 KB, 323 KB e 11,76 MB |
| `transformers/` (`transformers.min.js`, `ort-wasm-simd-threaded.jsep.mjs`, `ort-wasm-simd-threaded.jsep.wasm`) | `@huggingface/transformers@3.8.1/dist/` (o runtime ONNX vem no mesmo `dist/`) | Apache-2.0 (transformers.js); o runtime é o onnxruntime-web 1.22.0-dev, MIT | 888 KB, 44 KB e 21,6 MB |

Fora daqui, ainda na jsDelivr: `kokoro-js@1.2.1` (só o motor opcional "Kokoro no navegador", inglês). Os **pesos dos modelos** (Whisper, E5, Kokoro) continuam no Hugging Face e ficam no cache do navegador depois da primeira vez.

Mudanças em relação ao original:
- **transformers.js:** `src/transformers-local.js` carrega o `transformers.min.js` desta pasta e fixa `env.backends.onnx.wasm.wasmPaths` nela (o padrão apontava para a jsDelivr). Os arquivos em si não foram alterados.
- **wLipSync:** o build "single" (que embute o processador de áudio como URL `data:`, bloqueada pela CSP do app) foi trocado pelo build em arquivos. O app registra o worklet e compila o wasm em `src/lipsync.js`.
- **mathjs:** nos arquivos de `mathjs/` os endereços `/npm/<pacote>/+esm` foram trocados por caminhos relativos para `mathjs/deps/`. Nenhuma outra alteração de código.

Textos de licença: `LICENSES/` traz os que vieram nos pacotes do `node_modules` (mathjs, typed-function, decimal.js, complex.js, fraction.js, escape-latex, tiny-emitter e @babel/runtime). **Faltam os textos de seedrandom, javascript-natural-sort e wlipsync**: esses pacotes não trazem arquivo de licença no `node_modules` (wlipsync nem está instalado) e eu não baixei outro. Todos declaram MIT no campo `license` do npm. three e three-vrm carregam o aviso de licença no cabeçalho do próprio arquivo. **[CONFERIR]** antes de redistribuir fora deste repositório.
