# Testes manuais (o que a IA não consegue conferir aqui)

O navegador dos testes roda sem som audível, sem microfone de verdade e com a trava de
reprodução automática desligada (`--autoplay-policy=no-user-gesture-required`). Então
tudo que depende de ouvir, de falar ou da trava do navegador fica para o dono.

Marque cada linha com data e resultado quando testar.

## P8, áudio (06/10/2026)

| # | O que fazer | O que precisa acontecer | Resultado |
|---|---|---|---|
| 1 | Abrir o app numa aba nova e **não tocar em nada**. Esperar a sessão começar sozinha, se estiver configurada. | O navegador segura o som. Nada de áudio até o primeiro toque. | |
| 2 | Tocar em "Começar". | O som destrava e a fala do cumprimento sai inteira, sem cortar o começo. | |
| 3 | Arrastar a barra de volume de ponta a ponta durante uma fala. | O volume muda na hora, sem estalo nem salto. Na metade do curso soa mais ou menos pela metade. | |
| 4 | Apertar o alto-falante durante uma fala. | O som some em cerca de 60 ms e some de verdade, sem fio de som. Apertar de novo volta ao mesmo volume. | |
| 5 | Recarregar a página. | A barra volta onde estava, e o mudo também. | |
| 6 | Fazer uma pergunta longa, de três ou quatro frases. | O intervalo entre as frases é curto e sempre igual. Não dá para notar qual frase veio do cache. | |
| 7 | Apertar o microfone enquanto o personagem fala. | A fala para na hora, sem esperar o intervalo. | |
| 8 | Com o personagem falando baixinho ao fundo, apertar o microfone e falar. | O personagem cai para cerca de um terço do volume e volta sozinho ao fechar o microfone. | |
| 9 | Repetir o 3, o 4 e o 8 com o motor **Voz do sistema** (configurações, Motor de voz). | O volume e a redução de fundo **não** funcionam: essa voz toca fora do controle do app. Só o intervalo entre frases vale. Confirmar que é isso mesmo que acontece. | |
| 10 | Rodar o app nas caixas de som do local do evento, com barulho de fundo. | Dizer se -20 dBFS de alvo ficou alto, baixo ou certo. O alvo fica em `ALVO.rmsDb`, em `src/audio.js`. | |

## P8, normalização do pacote pré-gravado

Só quando existir um pacote de áudio gravado (seção 31 do REPERTORIO, item 8).

| # | O que fazer | O que precisa acontecer | Resultado |
|---|---|---|---|
| 11 | Instalar o ffmpeg (`winget install Gyan.FFmpeg`) e rodar `node tools/normalizar-audio.mjs <pasta>`. | Sai um relatório com I, TP e LRA antes e depois de cada arquivo, e os arquivos normalizados numa pasta nova. | |
| 12 | Ouvir os arquivos normalizados em sequência. | Todos no mesmo volume, sem nenhum estourado. | |

## P9, quiosque (06/10/2026)

O navegador dos testes roda numa máquina ligada, com GPU disponível e sem ninguém mexendo. O que falta conferir é o totem de verdade.

| # | O que fazer | O que precisa acontecer | Resultado |
|---|---|---|---|
| 13 | Engrenagem, Diagnóstico, "Testar queda de imagem". | A tela mostra "Um instante" e o personagem volta sozinho em poucos segundos, sem recarregar a página. | |
| 14 | Com o app aberto, suspender a máquina (fechar a tampa) e acordar depois de uns minutos. | O app **não** recarrega. O vigia entende suspensão como pausa, não como travamento. | |
| 15 | Deixar o app numa aba em segundo plano por uns minutos e voltar. | Mesma coisa: nada de recarga automática. | |
| 16 | Atualizar o driver de vídeo ou tirar e pôr o cabo de uma tela externa com o app aberto. | É o caso real de queda de contexto. Conferir se o aviso aparece e o personagem volta. | |
| 17 | Deixar o totem ligado a noite inteira com o app aberto. | De manhã, abrir a engrenagem: "Recargas automáticas" deve estar em 0 e "Erros" vazio ou com motivo conhecido. | |
| 18 | Conferir o painel com a chave real do Gemini depois de umas 20 perguntas. | "Gasto hoje" mostra valor em reais, e a cotação do dólar está atualizada. | |
| 19 | Olhar a tela do público com o totem de pé, a 1 m de distância. | A legenda do que o personagem fala é legível e nenhum texto fica apagado sobre o fundo. | |
| 20 | Navegar só pelo teclado (Tab e Enter), sem tocar na tela. | Dá para começar a conversa, mexer no volume e enviar uma pergunta escrita. O anel de foco é visível em todos. | |

## P9, teste de longa duração (pendente)

| # | O que fazer | O que precisa acontecer | Resultado |
|---|---|---|---|
| 21 | Numa hora em que a máquina esteja livre: `python serve.py 8771` num terminal e `node tools/maratona.mjs 4` em outro. | Ao fim, `relatorios/p9-maratona.json` com `status: completo`, 0 erros, FPS sem queda e heap no mesmo patamar do início. Subida contínua do heap é vazamento. | |
