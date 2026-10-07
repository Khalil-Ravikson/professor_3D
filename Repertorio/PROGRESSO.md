# Progresso

Atualizado em 07/10/2026. O log detalhado, com datas, está na seção 12 do `REPERTORIO.md`.

## No GitHub (último push: `6e20ec9`)
Fase 4 (P1 a P10), fase 5 I1 a I4 e I6, Gemini TTS (laboratório e motor selecionável), Teo novo, visualizador (prompt 06), microfone manual, projeção de gasto em reais, sessão que não fecha no meio, câmera livre na conversa.

## Só local, sem commit
I7 (acabamento), critique, audit, adapt e animate, "Tentar de novo", rótulos "Sugestões" e "Perguntar", linha "Voz do personagem" no diagnóstico, testes novos `p14-*`, `PRODUCT.md` atualizado.

## Prompts 2 e 3 (achado em 07/10/2026)
O `MEGA-PROMPT-MESTRE.md` manda executar os cinco prompts em ordem. Feitos: 1 (base), 4 (P1 a P10) e 5 (I1 a I7; falta o cadastro de personagem, pulado a pedido do dono, e o fechamento I8, que é este arquivo e o README). **Prompt 2 (REFINAMENTO) feito em parte, sem testes automáticos (adiados a pedido do dono):** R1 (luz por dados e qualidade adaptativa), R2 (emoções; faltam respiração e escuta ativa, que pedem clipes VRMA), R3 (cache offline e armazenamento), R6 (totem, CSP), R7 (detector e banco de perguntas), R8 (README). **Faltam R4 (RAG) e R5 (voz mãos-livres), que precisam de download e conteúdo seu:**
- R4: o modelo de embeddings `Xenova/multilingual-e5-small` (Hugging Face, ONNX quantizado de 118 MB, baixado no navegador de cada visitante na primeira vez) e documentos semente com `fonte:` e `licenca:` fornecidos por você. Sem fonte, não escrevo o documento.
- R5: `@ricky0123/vad-web` 0.0.31 e o `onnxruntime-web` 1.30.0 (144 MB descompactados no npm; o que vai para o navegador é o `.wasm` e o modelo de voz, a medir), hospedados em `assets/`.
**Prompt 3 (UEMA) não começou:** o corpus (U2) exige documentos oficiais da UEMA fornecidos por você.

## Falta
- **Fase 5:** I5 (só o visual do console do operador; o cadastro de personagem foi pulado a pedido do dono) e I8 (fechamento).
- **Gemini:** teto do AI Studio em R$ 7 (a projeção de 5.000 respostas é cerca de R$ 21): subir antes do evento. O id `gemini-3.1-flash-lite` (novo padrão) está NÃO TESTADO na API.
- **Voz:** ouvir as amostras e escolher (itens 28 e 29). Tocar o Gemini TTS por pedaços (streaming) não foi feito. Pacote de áudio pré-gravado e contador de caracteres (seção 30.3) não foram feitos. O erro de voz ainda não usa "Tentar de novo".
- **Modo Guiada offline** (seção 24, respostas e áudios prontos): não existe. "Sugestões" só esconde o campo e o microfone.
- **Relato aberto:** Teo com voz da Luma e a frase "Oi, que bom te ver". Não reproduzido; falta o dono abrir o diagnóstico (linha "Voz do personagem") com o Teo.
- **Testes (adiados a pedido do dono):** suíte completa depois das últimas edições; `p12` e M6.1 já estouraram só na rodada completa (causa não investigada); `gemini-real` bloqueado pelo teto.
- **Manuais:** `TESTES-MANUAIS.md`, itens 1 a 35. A maratona de 4 h (item 21) só rodou 9 minutos.
- **Decisões do dono:** `MAX_RODADAS` do Rafa; aceno do Mixamo com "Character Arm-Space" maior; phonemizer/eSpeak NG (GPL) no Kokoro do navegador; aprovar `PROPOSTA-SKILL-VRM.md`; `references/` da skill vrm-avatar-web.

## Arquivos fora do git
`.env.local`, `VRMA_MotionPack/`, `assets/animations/aceno*.fbx` e `aceno*.vrma`, `amostras/`, `relatorios/voz/audio/`, `assets/avatars/teo3.vrm` (licença `Redistribution_Prohibited`, **nunca commitar**).

## Regra aprendida
Nunca `git add -A` quando houver `.vrm` na pasta. Adicionar por caminho.
