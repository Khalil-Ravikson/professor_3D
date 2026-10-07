# Licenças de terceiros

Gerado por `node tools/licencas.mjs`. Não edite à mão: rode o script de novo.

## Dependências de código

| Pacote | Versão | Uso | Licença | Alerta |
| --- | --- | --- | --- | --- |
| @huggingface/transformers | 3.8.1 | navegador (CDN) | Apache-2.0 |  |
| @mediapipe/tasks-vision | 1.0.1 | navegador (CDN) | Apache-2.0 |  |
| @pixiv/three-vrm | 3.5.5 | navegador (CDN) | MIT |  |
| @pixiv/three-vrm-animation | 3.5.5 | navegador (CDN) | MIT |  |
| @playwright/test | 1.63.0 | só testes | Apache-2.0 |  |
| kokoro-js | 1.2.1 | navegador (CDN) | Apache-2.0 |  |
| mathjs | 15.2.0 | dependência | Apache-2.0 |  |
| three | 0.180.0 | navegador (CDN) | MIT |  |
| wlipsync | 1.3.1 | navegador (CDN) | MIT |  |
| src/vendor/mixamo (exemplo do three-vrm v3.5.5) |  | copiado no código | MIT, pixiv Inc. |  |
| assets/mediapipe/face_landmarker.task (modelo do MediaPipe) |  | copiado no código | Apache-2.0 |  |
| assets/vad/ (voz mãos-livres, ver assets/vad/CREDITS.md): @ricky0123/vad-web 0.0.31 (ISC) e onnxruntime-web 1.22.0 (MIT) |  | copiado no código | ISC e MIT |  |
| assets/vad/silero_vad_legacy.onnx (modelo Silero VAD) |  | copiado no código | MIT declarada pelo repositório do Silero; texto da licença não vem no pacote [CONFERIR] |  |
| Xenova/multilingual-e5-small (embeddings do RAG, baixado do Hugging Face no navegador, não fica no repositório) |  | copiado no código | licença do modelo [CONFERIR] na página do modelo antes de publicar |  |

## Dependências dentro dos bundles (um nível)

| Pacote | Versão | Vem de | Licença | Aviso |
| --- | --- | --- | --- | --- |
| onnxruntime-web | 1.22.0-dev | @huggingface/transformers | MIT |  |
| @huggingface/jinja | 0.5.3 | @huggingface/transformers | MIT |  |
| phonemizer | 1.2.1 | kokoro-js | Apache-2.0 (declarada) | usa o eSpeak NG, que é GPL-3.0. Só entra no motor opcional "Kokoro no navegador" (inglês). Conferir antes de publicar com esse motor ligado |

## Fontes

| Fonte | Licença |
| --- | --- |
| Atkinson Hyperlegible | OFL-1.1 |
| Baloo 2 | OFL-1.1 |
| JetBrains Mono | OFL-1.1 |

## Modelos (.vrm), lidos dos metadados

| Arquivo | Título | Autor | VRM | Licença | Decisão | Motivos |
| --- | --- | --- | --- | --- | --- | --- |
| 8590256991748008892.vrm | AvatarSample_A | VRoid Project | 0.x | Other | permitido |  |
| luma.vrm | Eugenia | [VIPEDeployer / 0xded150f6c599b08950919cfb0b97516b6235a36b] | 0.x | CC0 | permitido |  |
| nina.vrm | Juanita | 0xded150f6c599b08950919cfb0b97516b6235a36b | 0.x | CC0 | permitido |  |
| rafa.vrm | Bruno | 0xded150f6c599b08950919cfb0b97516b6235a36b | 0.x | CC0 | permitido |  |
| teo.vrm | AvatarSample_C | VRoid Project | 0.x | Other | permitido |  |
| teo3.vrm | Anime Boy | Kaosvs | 0.x | Redistribution_Prohibited | bloqueado | só o autor pode usar este avatar; redistribuição proibida: o arquivo não pode ir para o repositório público; uso comercial proibido: confirme que o evento não tem fins lucrativos |

## Clipes de animação

Pacote VRoid e arquivos do Mixamo ficam fora do repositório (`.gitignore`). Frase de crédito do pacote VRoid: "Animation credits to pixiv Inc.'s VRoid Project".

| id | Arquivo | Origem | Licença | No repositório |
| --- | --- | --- | --- | --- |
| idle | assets/animations/idle.vrma | github.com/pixiv/ChatVRM, public/idle_loop.vrma | MIT, (c) 2023 pixiv Inc. | sim |
| aceno | assets/animations/aceno2.vrma | Mixamo (Adobe), convertido com fbx2vrma-converter (aceno2.fbx) | Termos da Adobe/Mixamo: uso livre em projetos; proibido distribuir o arquivo solto | não |
| aceno-ciclo | assets/animations/aceno.vrma | Mixamo (Adobe), convertido com fbx2vrma-converter (aceno.fbx) | Termos da Adobe/Mixamo: uso livre em projetos; proibido distribuir o arquivo solto | não |
| mostrar-corpo | VRMA_MotionPack/VRMA_MotionPack/vrma/VRMA_01.vrma | Pacote VRMA_MotionPack do VRoid Project (BOOTH). Readme: Show full body | Termos do pacote VRoid: uso livre e comercial com crédito; proibido redistribuir | não |
| cumprimento-agachado | VRMA_MotionPack/VRMA_MotionPack/vrma/VRMA_02.vrma | Pacote VRMA_MotionPack do VRoid Project (BOOTH). Readme: Greeting | Termos do pacote VRoid: uso livre e comercial com crédito; proibido redistribuir | não |
| sinal-paz | VRMA_MotionPack/VRMA_MotionPack/vrma/VRMA_03.vrma | Pacote VRMA_MotionPack do VRoid Project (BOOTH). Readme: Peace sign | Termos do pacote VRoid: uso livre e comercial com crédito; proibido redistribuir | não |
| dedo-arma | VRMA_MotionPack/VRMA_MotionPack/vrma/VRMA_04.vrma | Pacote VRMA_MotionPack do VRoid Project (BOOTH). Readme: Shoot | Termos do pacote VRoid: uso livre e comercial com crédito; proibido redistribuir | não |
| giro | VRMA_MotionPack/VRMA_MotionPack/vrma/VRMA_05.vrma | Pacote VRMA_MotionPack do VRoid Project (BOOTH). Readme: Spin | Termos do pacote VRoid: uso livre e comercial com crédito; proibido redistribuir | não |
| pose-modelo | VRMA_MotionPack/VRMA_MotionPack/vrma/VRMA_06.vrma | Pacote VRMA_MotionPack do VRoid Project (BOOTH). Readme: Model pose | Termos do pacote VRoid: uso livre e comercial com crédito; proibido redistribuir | não |
| agachar | VRMA_MotionPack/VRMA_MotionPack/vrma/VRMA_07.vrma | Pacote VRMA_MotionPack do VRoid Project (BOOTH). Readme: Squat | Termos do pacote VRoid: uso livre e comercial com crédito; proibido redistribuir | não |

## Avisos (não bloqueiam)

- phonemizer@1.2.1 (via kokoro-js): usa o eSpeak NG, que é GPL-3.0. Só entra no motor opcional "Kokoro no navegador" (inglês). Conferir antes de publicar com esse motor ligado

## Problemas

- modelo teo3.vrm: só o autor pode usar este avatar; redistribuição proibida: o arquivo não pode ir para o repositório público
