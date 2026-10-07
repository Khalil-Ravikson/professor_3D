# Voz mãos-livres: arquivos hospedados

Hospedados aqui (e não na CDN) para o totem funcionar sem internet. Versões fixas, conferidas em 07/10/2026.

| Arquivo | Origem | Licença declarada | Tamanho |
|---|---|---|---|
| `vad-web.bundle.min.js`, `vad.worklet.bundle.min.js` | `@ricky0123/vad-web` 0.0.31, pasta `dist/` do pacote npm (https://github.com/ricky0123/vad) | ISC (campo `license` do `package.json` do pacote) | 69 KB e 2,4 KB |
| `silero_vad_legacy.onnx` | mesmo pacote, `dist/`. É o modelo Silero VAD (https://github.com/snakers4/silero-vad) | **[CONFERIR]** o pacote não traz o texto da licença do modelo; o repositório do Silero declara MIT | 1,8 MB |
| `ort.wasm.min.js`, `ort-wasm-simd-threaded.mjs`, `ort-wasm-simd-threaded.wasm` | `onnxruntime-web` 1.22.0, pasta `dist/` do pacote npm. É a versão com que o vad-web foi construído (consta em `bundle.min.js.LICENSE.txt`) | MIT (cabeçalho do `ort.wasm.min.js`; o pacote não traz arquivo LICENSE) | 48 KB, 21 KB e 11,2 MB |

Total: cerca de 13 MB. Nada daqui é criado pelo projeto.

Atualizar: baixe os pacotes com `npm pack @ricky0123/vad-web@<versão>` e `npm pack onnxruntime-web@<versão que o vad-web declara no bundle>`, troque os arquivos e suba `BIN` em `sw.js` e `CACHE_BIN` em `src/armazenamento.js`.
