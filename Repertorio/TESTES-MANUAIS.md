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

## Visualizador (prompt 06): só o que o teste automático não alcança

| # | O que fazer | O que precisa acontecer | Resultado |
|---|---|---|---|
| 22 | Na conversa, tocar no ícone do olho (canto superior), depois no ícone de tela cheia. Num notebook ou desktop. | A tela cheia de verdade abre, a barra some depois de 3 s sem mexer o mouse e volta ao mexer. F e Esc também funcionam. | |
| 23 | No celular ou tablet: girar a câmera com um dedo, aproximar com dois dedos (pinça) e arrastar com dois dedos. | O personagem gira, aproxima e desloca sem a página rolar. O toque nunca escorrega para a página. | |
| 24 | No celular: dois toques rápidos no personagem. | A câmera volta ao enquadramento padrão em meio segundo, sem salto. | |
| 25 | No iPhone (Safari): tocar em tela cheia. | O navegador não tem a API; a imagem ocupa a janela inteira e aparece o aviso "Este navegador não tem tela cheia". | |
| 26 | Com o rastreamento ligado, tocar um clipe que mexe o corpo (giro ou aceno) e olhar. | A câmera acompanha a cabeça com suavidade, sem tremer. Girar à mão pausa o rastreamento por 3 s. | |
| 27 | Pelo painel do operador, galeria, "Abrir no visualizador", e deixar o loop rodar uns minutos em "todos". | Passa de clipe em clipe com a transição suave de 0,3 s, sem o personagem ficar parado em T. | |

## Gemini TTS: ouvir (decide a escolha de voz)

| # | O que fazer | O que precisa acontecer | Resultado |
|---|---|---|---|
| 28 | Ouvir os `.wav` de `relatorios/voz/audio/`, principalmente a frase `nomes` (Maranhão, UEMA, Imperatriz, Caxias) e as com estilo. | Dizer qual voz e qual modelo soam melhor em português do Brasil e se a pronúncia dos nomes está aceitável. A qualidade não foi avaliada por mim. | |
| 29 | Nas configurações, escolher "Gemini TTS" no motor de voz e conversar com um personagem. | A fala sai com a voz escolhida; o selo mostra "Voz: Gemini"; "Voz Gemini hoje" mostra falas, caracteres e reais no diagnóstico. | |


## Microfone manual

| # | O que fazer | O que precisa acontecer | Resultado |
|---|---|---|---|
| 30 | Apertar o microfone, falar uma frase, parar uns 3 s no meio, continuar e só então apertar de novo. | O microfone continua aberto durante a pausa e só fecha no segundo toque. A frase inteira vai como pergunta. No Brave (Whisper local) também não há corte aos 20 s. | |

## I4, barra de comando

| # | O que fazer | O que precisa acontecer | Resultado |
|---|---|---|---|
| 31 | No totem, tocar em "+", depois em "O que cada sinal quer dizer", e falar com o personagem olhando o sinal (Pronto, Ouvindo, Pensando, Falando). | O menu abre acima da barra, a legenda mostra os cinco sinais, e a palavra do sinal muda junto com a cor. Dá para ler a 1 m de distância. | |
| 32 | Tocar em "Guiada" e entregar o totem a uma criança. | Só as perguntas sugeridas aparecem; sem campo de texto e sem microfone. "Livre" devolve os dois. A escolha fica depois de recarregar. | |

## Sessão e câmera livre

| # | O que fazer | O que precisa acontecer | Resultado |
|---|---|---|---|
| 33 | Começar uma conversa, passar para o modo escrito e digitar devagar por uns 3 minutos sem enviar. | A sessão não fecha enquanto digita. Parar de mexer por 90 s fecha com a despedida. | |
| 34 | Na conversa, girar a câmera com o dedo, aproximar com a pinça e dar dois toques rápidos. | Gira e aproxima sem rolar a página; dois toques voltam ao enquadramento em meio segundo. | |
| 35 | Falar com o microfone aberto e fechar a conversa pelo "+", "Terminar a conversa". | O personagem se despede e o microfone fecha. Nenhuma pergunta nova nasce sozinha. | |
