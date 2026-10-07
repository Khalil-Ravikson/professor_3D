# Progresso

Atualizado em 06/10/2026. O log detalhado, com datas, está na seção 12 do `REPERTORIO.md`.

## Feito e no GitHub
Fase 1 a 4 (P1 a P10) e fase 5 I1 a I3 (direção visual, seleção, vitrine e "Ouvir voz").

## Feito e só local (commitado, ainda não enviado)
- Laboratório de voz do Gemini TTS (`tools/lab-voz.mjs`) e o motor Gemini TTS selecionável no app.
- Teo novo (AvatarSample_C, VRoid Project, licença livre).
- Visualizador de personagem (prompt 06).

## Pendente
- **Fase 5:** I4 feita (barra de comando, local, não commitada). Faltam I5 (cadastro de personagem pulado a pedido do dono; sobra só o visual do console) (console do operador), I7 (acabamento), I8 (fechamento). Pulados a pedido do dono para fazer o Gemini TTS e o visualizador antes.
- **Voz:** ouvir as amostras e escolher (itens 28 e 29 do roteiro manual). Streaming do Gemini TTS (primeiro áudio em 1 a 2 s) pede tocar por pedaços. Pacote de áudio pré-gravado e contagem de caracteres para o orçamento (seção 30.3).
- **Decisões do dono:** modelo do Gemini de texto (3.5 Flash dá R$ 124 por 5.000 respostas, 3.1 Flash-Lite dá R$ 21); `MAX_RODADAS` do Rafa; aceno do Mixamo com "Character Arm-Space" maior; phonemizer/eSpeak NG (GPL) no motor Kokoro do navegador.
- **Testes manuais:** `TESTES-MANUAIS.md`, itens 1 a 29. A maratona de 4 h (item 21) só rodou 9 minutos.

## Arquivos fora do git
`.env.local`, `VRMA_MotionPack/`, `assets/animations/aceno*.fbx` e `aceno*.vrma`, `amostras/`, `relatorios/voz/audio/`, `assets/avatars/teo3.vrm` (licença `Redistribution_Prohibited`, **nunca commitar**).

## Regra aprendida
Nunca `git add -A` quando houver `.vrm` na pasta: um commit local quase levou um arquivo de redistribuição proibida. Adicionar por caminho.
