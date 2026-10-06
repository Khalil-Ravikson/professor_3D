# Laboratório de voz (2026-10-06)

Chromium, mesma máquina, mesmas frases. Fator = tempo de geração dividido pela duração do áudio (abaixo de 1, gera mais rápido do que fala).
Câmbio R$ 5,17. Preços do Gemini: página oficial em 06/10/2026, válidos até 31/12/2026 (dobram em 01/01/2027).

| Motor, modelo (voz) | Chamadas | Mediana (ms) | Pior (ms) | Fator mediano | Caracteres por segundo | Custo médio por chamada (R$) |
|---|---|---|---|---|---|---|
| gemini-3.8-flash-tts (Kore) | 8 | 4312 | 7766 | 0.99 | 11 | 0.0072 |
| gemini-3.8-flash-tts (Puck) | 6 | 4683 | 6736 | 0.96 | 14 | 0.0076 |
| gemini-3.8-flash-lite-tts (Kore) | 6 | 3898 | 6088 | 0.76 | 11 | 0.0056 |
| gemini-3.8-flash-lite-tts (Puck) | 6 | 3796 | 5755 | 0.81 | 14 | 0.0052 |
| gemini-3.8-flash-tts (Kore, com estilo) | 2 | 8157 | 11426 | 0.56 | 7 | 0.0200 |
| kokoro (local) (pf_dora) | 6 | 2311 | 8949 | 0.60 | 16 | 0 (local) |

Gasto total desta rodada: R$ 0.2085.

## Streaming (sonda)

- gemini-3.8-flash-tts: 1º áudio em 1699 ms, total 7065 ms, 220 trechos, 13.68 s de áudio
- gemini-3.8-flash-lite-tts: 1º áudio em 1097 ms, total 4416 ms, 192 trechos, 14.4 s de áudio
