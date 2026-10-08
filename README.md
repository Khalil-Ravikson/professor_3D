# Professores 3D

Personagens 3D (VRM) que conversam no navegador. O Gemini responde, o Kokoro fala em português, e a boca se move com o áudio.

## Rodar

1. Suba o servidor de voz Kokoro (Docker Desktop precisa estar aberto):

   ```bash
   docker run -d --restart unless-stopped --name kokoro -p 127.0.0.1:8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:v0.9.0
   ```

   Nas próximas vezes: `docker start kokoro`. Para parar: `docker stop kokoro`.
   A imagem tem ~5 GB. O `127.0.0.1` impede que outras máquinas da rede usem o servidor.

2. Sirva a pasta:

   ```bash
   python serve.py
   ```

   Abra `http://localhost:8770`. Não use `file://`: o `.vrm` e o áudio precisam de HTTP.
   O `serve.py` desliga o cache; com `python -m http.server`, o navegador fica com o `.js` antigo depois de uma edição.

3. Na engrenagem, coloque a chave do Gemini. Ela fica só neste navegador.

## Voz

| Motor | Quando usar |
|---|---|
| Kokoro no servidor local | Padrão. Único caminho com vozes em português (`pf_dora`, `pm_alex`, `pm_santa`). |
| Kokoro no navegador | Só inglês: o `kokoro-js` 1.2.1 não expõe vozes em português. Baixa ~310 MB na primeira vez (WebGPU). |
| Voz do sistema | Reserva automática quando o servidor não responde. O selo no canto do palco avisa. |

- **CORS:** o Kokoro-FastAPI v0.9.0 responde `access-control-allow-origin: *`, então a página chama direto, sem configuração.
- **Desempenho:** em CPU de 4 núcleos, uma frase leva de 1 a 3 s para ficar pronta. Com outros programas pesados abertos, aparecem pausas entre as frases.

### Vozes grátis do Microsoft Edge

No Edge aparecem vozes neurais em português ("Microsoft Francisca Online (Natural)", "Antonio"). No modo de voz **Automático** (o padrão), o app usa essas vozes quando elas existem: Francisca para Luma e Nina, Antonio para Teo e Rafa. Quando não existem, usa o Kokoro.

Duas ressalvas: elas precisam de internet, e a boca se mexe por palavra, não pelo áudio.

### Volume e nivelamento

O controle de volume fica no canto do palco, embaixo do selo de voz: alto-falante para o mudo e barra para o volume. A escolha fica guardada neste navegador. O curso da barra é aplicado ao quadrado, então metade do curso soa pela metade.

Três coisas acontecem sozinhas, em `src/audio.js`:

- **Nivelamento por frase.** Cada frase sintetizada passa por um ganho próprio, calculado para o volume médio (RMS) chegar a -20 dBFS sem o pico passar de -1,5 dBFS. Frases baixas e altas chegam no mesmo volume. É RMS em dBFS, não LUFS do EBU R128.
- **Intervalo entre sentenças.** 180 ms, sempre o mesmo, independente do motor e do tamanho da frase. Parar no meio não espera o intervalo.
- **Redução do fundo.** Enquanto o microfone está aberto, o personagem cai para 30% do volume em vez de ficar mudo.

Nada disso vale para a voz do sistema (Web Speech): ela toca fora do `AudioContext`, então o app não tem como medir nem mexer no volume dela. Só o intervalo entre sentenças continua valendo.

Medir o volume de arquivos antes e depois do nivelamento:

```bash
node tools/medir-audio.mjs amostras/gemini-tts-Kore.wav
```

Normalizar um pacote de áudio pré-gravado (precisa do ffmpeg no PATH, `winget install Gyan.FFmpeg`):

```bash
node tools/normalizar-audio.mjs audios audios-normalizados --alvo -16
```

## Teo e Rafa: quadro e calculadora

- Esses dois respondem em linhas `FALA:` (vai para a voz) e `QUADRO:` (vai para o quadro).
- Toda conta passa pela função `calcular` (mathjs, no navegador).
- Número no quadro que não veio do enunciado, de uma "Suposição:" nem da calculadora aparece como **?**.

## Câmera

- **Ligar e desligar:** pelo botão de câmera no palco. Ela começa desligada e não liga sozinha. Enquanto está ligada, aparece "Câmera ligada" em vermelho.
- **O que faz:**
  - cumprimenta quando alguém aparece (no máximo uma vez a cada 45 s);
  - o olhar acompanha a pessoa;
  - sorri de volta;
  - tem um modo espelho opcional, em que o avatar imita o rosto.
- **Privacidade:** a imagem nunca sai do computador. Nada é gravado, salvo ou enviado; só a posição do rosto e o sorriso viram números usados na hora.
- **Recursos:** a inferência roda a 15 quadros por segundo e pausa com a aba oculta. O modelo fica em `assets/mediapipe/`.

## Ajustes por personagem

Em Configurações → Personagem dá para mudar instruções, limite de palavras faladas, temperatura, voz Kokoro e velocidade. Os ajustes ficam neste navegador; "Restaurar" volta ao padrão de `src/characters.js`.

- **Temperatura:** nos modelos Gemini 3, a Google recomenda deixar no padrão (1,0).

## Avatares

Ficam em `assets/avatars/<nome>.vrm`. O seletor só mostra personagens cujo arquivo existe. Autor, fonte e licença de cada um estão em `assets/avatars/CREDITS.md`.

Onde conseguir `.vrm`:

- **opensourceavatars.com:** CC0. A coleção 100Avatars R3 tem expressões completas.
- **VRoid Hub:** a licença varia por modelo. Se não for CC0, não commite o arquivo.

## Animações e boca

- **Corpo:** só por VRMA, em `assets/animations/<nome>.vrma`. Hoje só existe `idle` (do ChatVRM, MIT). `talk`, `think` e `greet` usam o `idle` até você colocar os arquivos. Veja `assets/animations/CREDITS.md` para saber onde conseguir cada um e o que a licença permite.
- **Boca:** segue o áudio que está tocando. O padrão pega o formato da vogal do wLipSync e a abertura do volume. Dá para trocar em Configurações → Movimento da boca.
- **Comparar os métodos:** `comparar-lipsync.html` mostra o mesmo áudio em três avatares lado a lado.

### Visualizador de personagem

Na conversa, o ícone do olho (canto superior direito) abre o visualizador; no painel do operador, a galeria tem o botão "Abrir no visualizador", que já começa tocando os clipes ligados.

| O que | Como |
|---|---|
| Girar, aproximar, deslocar | mouse (arrastar, roda, botão direito) ou toque (um dedo gira, pinça aproxima, dois dedos deslocam) |
| Voltar a câmera | botão, duplo clique, duplo toque ou **R**. Volta ao `enquadramento` do personagem em 0,5 s |
| Seguir a cabeça | botão ou **T**. Girar à mão pausa por 3 s |
| Tela cheia | botão ou **F**. A barra some depois de 3 s sem mexer. Sem a API (iPhone), a imagem ocupa a janela e avisa |
| Loop | repetir um, todos em sequência ou aleatório; **Espaço** toca ou pausa; **setas** trocam de clipe; velocidade de 0,5x a 1,5x |
| Sair | botão X ou **Esc** |

Só entram os clipes `ativos` do catálogo (e, no modo infantil, os marcados "ok para criança"). Com "reduzir movimento" do sistema o loop começa pausado.

### Entrada por personagem (prompt 07, V2)

Cada personagem abre o visualizador com o **seu** clipe, definido em `characters.js`: `amostraEntrada: { clipe, modo }` e `loopAnimacoes: [ids]`. `modo: 'repetir'` repete só aquele clipe; `modo: 'lista-depois'` toca o clipe uma vez e segue em loop pelos ids de `loopAnimacoes`. Atribuição aprovada pelo dono em 08/10/2026: **Luma** abre acenando e segue por `mostrar-corpo`, `giro` e `sinal-paz`; **Teo** abre em `pose-modelo` e repete só ela. Os botões anterior e próximo continuam passando por todos os clipes ativos; só o avanço automático segue a lista do personagem. Se o clipe de entrada não estiver ativo (modo infantil, arquivo ausente num clone novo), cai para o `idle` e a lacuna aparece em `visualizador.estado.lacuna` e no console. Personagem sem entrada definida abre no primeiro clipe, como antes.

### Como mexer nos clipes

O catálogo é `assets/animations/animacoes.json`. Cada clipe tem `id`, `arquivo`, `descricao`, `casoDeUso`, `loop`, `duracao`, `intensidade` (1 a 3), `infantilOk`, `origem`, `licenca` e `status` (`ativo`, `desligado`, `lacuna`, `procedural`). A seção `estados` liga cada estado ou gesto a um id de clipe, ou a uma lista (o diretor alterna). `null` é lacuna: o estado cai para o `idle` e o gesto é ignorado.

**Adicionar um clipe**
1. Ponha o `.vrma` em `assets/animations/`. Mixamo: baixe em FBX "Without Skin" e use a aba Enviar movimento (Configurações), que converte no navegador. Não confie no número do arquivo: veja o clipe tocando antes de dar nome.
2. Acrescente o registro em `animacoes.json` e anote origem e licença em `assets/animations/CREDITS.md`.
3. Se for do Mixamo ou do pacote do VRoid, acrescente o nome no `.gitignore`: são arquivos que não podem ser redistribuídos.

**Ligar ou desligar um clipe:** Configurações, Animações. O interruptor "Ligado" e a marca "Ok para criança" ficam guardados neste navegador, por cima do JSON. Só entra na conversa quem está ligado.

**Dar um gesto a um personagem:** o gesto vive em `estados` do catálogo, não no personagem. O LLM só recebe a lista dos gestos que têm clipe ativo, e pedido de gesto inexistente é ignorado e registrado. Para um clipe novo virar o aceno de todos, aponte `estados.aceno` para o id dele.

**Onde baixar o pacote VRMA:** o "VRMA_MotionPack" do VRoid Project, na BOOTH, com a sua conta. O readme proíbe redistribuir, então a pasta fica no `.gitignore` e cada pessoa baixa a sua. Frase de crédito do readme: "Animation credits to pixiv Inc.'s VRoid Project".

**Refazer a folha de contato** (4 instantes de cada clipe, mais as medidas de quadril):

```bash
python serve.py 8771
node tools/gerar-folhas.mjs
```

Sai em `relatorios/folhas/`.

## Avaliação completa

```bash
npm run avaliar          # tudo, inclusive a medição de desempenho (gasta 3 perguntas da chave)
npm run avaliar:rapido   # sem a medição de desempenho
```

Roda, nesta ordem: detector anti-slop, testes unitários, política de segurança (CSP), banco de perguntas, licenças, animação e gestos, sessão e fluxo, áudio e quiosque, nivelamento de áudio e desempenho. Sobe o servidor na 8771 se ninguém estiver atendendo. Devolve código 1 se qualquer etapa falhar e grava `relatorios/avaliacao.json`.

## Adicionar um personagem

1. Coloque o `.vrm` em `assets/avatars/`.
2. Acrescente um objeto em `src/characters.js`, copiando um existente. Os campos principais:
   - `id` e `nome`;
   - `arquivoVrm`;
   - `persona` (o prompt do personagem);
   - `voz` (`{ motor, id, speed }`);
   - `enquadramento`;
   - `atalhos`;
   - `paleta`.
3. Recarregue. A miniatura é gerada sozinha a partir do modelo.

`voz.id` aceita mistura de vozes no formato do servidor, por exemplo `pm_alex(1)+pm_santa(1)`.

## Animações de fala (Overte)

Os estados do corpo vêm de `assets/animations/animacoes.json`; cada personagem pode trocar o clipe de um estado em `estados` (`src/characters.js`): a Luma fala com `fala-leve`, o Teo com `fala-base`. Os clipes são do projeto Overte (Apache-2.0, via Undi95/Hanami), sem edição, em `assets/animations/overte/`; o aviso de licença, a origem e o SHA-256 estão em `assets/animations/CREDITS.md`. `assentir`, `pensar` e `aplauso` são os gestos "agradece", "nao-sei" e "aplaude". Falas de reserva (`fala-media`, `fala-mao-esq`, `fala-mao-dir`) ficam desligadas e podem ser ligadas na galeria. **A fala ao vivo, com áudio, NÃO foi testada** (itens 112 a 114 do roteiro).

## Expressões, olhar, foto e vídeo (prompt 7, V3 e V4)

Engrenagem, aba **Animações**, só para o operador.

- **Expressões:** um controle de 0 a 100 para cada expressão que o `.vrm` realmente tem (no modelo da Luma: neutral, angry, relaxed, happy, sad e `Surprised`; os visemas da boca, a piscada e o olhar não aparecem). O valor manual **sobrescreve** a expressão do clipe e a da emoção; a boca falando continua mandando nos visemas. "Zerar expressões" devolve o comando ao clipe.
- **Olhar:** Automático (segue o rosto da câmera ou faz sacadas), Olhar para a câmera, ou Escolher a direção (esquerda e direita, para baixo e para cima). O olhar tem um dono só: o seu código, nunca o clipe.
- **Foto e vídeo:** só do **personagem** (nunca a imagem da webcam nem a interface), salvos neste computador, sem envio. **Desligados por padrão** e sempre desligados no modo totem; o operador marca "Permitir foto e vídeo". Só funcionam se a licença do modelo e a do clipe em uso permitirem (`src/captura-licenca.js`): modelo bloqueado, clipe com texto que proíbe o uso, ou licença em "conferir" sem confirmação do operador bloqueiam, e o crédito exigido aparece na tela e pode ser escrito na imagem. Foto em PNG com fundo transparente, branco ou a cor do personagem, nas proporções 1:1, 4:5, 16:9 e 9:16, com moldura opcional e contagem de 3 segundos. Vídeo por `captureStream` e `MediaRecorder` (WebM ou MP4, o primeiro formato que o navegador grava; sem suporte, o app avisa), com duração máxima configurável (15 s por padrão) e contagem de segundos restantes. O nome do arquivo leva só o personagem e a data.
- **Interpretação de licença (não é parecer jurídico):** "proibido distribuir o arquivo solto" (Mixamo) e "proibido redistribuir" (pacote VRoid) falam do arquivo do clipe, não de uma foto que o mostra em uso; por isso não bloqueiam. Confirme com o dono dos termos antes de usar fora do evento.

## Rastreamento do corpo (braços e tronco)

- **Desligado por padrão.** Botão do **boneco** no topo da tela (na conversa, ao lado do olho e da câmera), botão do boneco na barra do visualizador, ou engrenagem, aba **Sessão**, "Rastreamento do corpo". Não confundir com a câmera do rosto (cabeça, olhos e boca), que é outro módulo. Só liga a câmera quando você pede; nenhum quadro é guardado, gravado ou enviado (o worker fecha cada imagem logo depois de usar e só devolve números); ao desligar, as tracks e o worker param.
- **Como funciona:** o Pose Landmarker do MediaPipe (modelos locais em `assets/vendor/mediapipe/modelos/`) roda num worker; os 33 pontos de mundo são filtrados (One Euro) e viram rotações dos ossos humanoides normalizados do VRM **por direção** (não por posição), lidas do repouso do próprio modelo (braço em T ou em A, VRM 0.x com x e z invertidos). Entra por cima do clipe, entre `mixer.update` e `vrm.update`, com peso por parte do corpo (braços e tronco), queda gradual em 300 ms quando a confiança cai e volta suave.
- **Webcam de mesa:** cada braço tem a sua confiança (mão fora do quadro derruba só aquele braço) e o tronco não depende do quadril (fora de quadro, não inclina; só a guinada dos ombros). A linha de estado mostra a confiança de cada parte.
- **Calibração:** ao ligar, o app espera o corpo aparecer (ombros e braços), pede para ficar parado e mostra o progresso em porcentagem. Só conta a pessoa PARADA: se o tronco se mexe, a janela recomeça com "Você se mexeu". Leva no mínimo 1,5 s, descarta as amostras mais distantes (um tranco não entorta a base) e, depois de pronta, a base acompanha devagar a postura de repouso (cerca de 20 s), então a calibração não "envelhece". O botão Recalibrar repete.
- **Mãos e dedos fluidos:** os pontos da mão passam por filtro One Euro, a última mão vista continua valendo por 350 ms (a detecção pisca) e some de vez depois de 1 s, cada mão fica no lado dela (continuidade do pulso; sem pulso visível vale o rótulo do modelo, trocado), os dedos usam suavização mais rápida (24 rad/s e 30 ms) e o osso da mão usa a direção dos pontos da própria mão. Se o computador não acompanhar, as mãos passam a rodar em quadros alternados antes de os dedos serem desligados. `fluido: false` na configuração do rastreador volta ao comportamento antigo, para comparar.
- **Espelho** (padrão): a sua mão direita move o braço que aparece do lado direito da tela. Desligado, o personagem age como uma pessoa de frente para você.
- **Qualidade:** Leve (pose lite, 5,8 MB) ou Equilibrada (pose full, 9,4 MB). Se a inferência passar do orçamento do quadro, a taxa cai para 15 e depois 10 por segundo, com aviso.
- **Gravar e repetir (só números):** o painel grava os pontos (nunca vídeo) num JSON e repete o arquivo no mesmo caminho do ao vivo. Serve para regressão e para você me mandar uma sessão curta para ajuste.
- **Mãos e dedos (V6):** o Hand Landmarker (modelo local) dá 21 pontos por mão; cada junta dobra pelo ângulo entre segmentos e vira rotação dos ossos dos dedos do VRM. Cada mão detectada vai para o pulso da pose mais próximo (a documentação diz que o rótulo "Left" ou "Right" assume imagem espelhada, e o vídeo da webcam aqui não é espelhado). Dedos que o clipe não anima voltam ao repouso quando o rastreamento solta. **O polegar é aproximado e não foi validado com uma mão real.**
- **Torção do punho e dedos estáveis:** a mão do personagem recebe a rotação completa do punho (inclusive a torção, palma para cima ou para baixo) a partir de dois vetores da própria mão, pulso até o dedo médio e indicador até o mindinho; sem a mão detectada só a direção vale, como antes. Os dedos são medidos no plano em que dobram, com zona morta macia de cerca de 6 graus, e a junta da ponta é misturada com a do meio (acoplamento natural do dedo). Medido com mão sintética: tremor 0,0753 para 0,0128, quedas 5 para 0. **Ao vivo: NÃO TESTADO** (itens 103 a 106 do roteiro).
- **Movimento do corpo (V6):** deslocamento lateral (até 30 cm) e de profundidade (até 20 cm) da cena do avatar, a partir da posição e da escala dos ombros na imagem contra a base da calibração, com zona morta de 3 cm e retorno suave ao centro.
- **Gestos que disparam clipes (V6):** acenar com o pulso acima do cotovelo faz o personagem acenar de volta; mão levantada acima do ombro por 0,8 s faz o personagem dizer "Pode perguntar!" (só se a sessão não bateu no limite de perguntas ou de tempo); joinha dispara a comemoração. Exigem vários quadros seguidos, têm intervalo mínimo entre disparos e um interruptor.
- **Qualidade adaptativa:** inferência acima do orçamento do quadro reduz a taxa, depois desliga os dedos, depois o movimento, com aviso.
- **Pernas:** **não implementadas** (o prompt as pede experimentais e desligadas; ficam fora desta rodada).
- **Photo Booth (desempenho):** `node tools/medir-photobooth.mjs` mede a abertura, o FPS e o vazamento em 20 aberturas e fechamentos. No Chromium com render por software: abertura de 2,2 s e sem crescimento de geometrias, texturas ou DOM. A latência do rastreamento em máquina real **não foi medida**.
- **Verificação:** `node tools/medir-rastreamento.mjs` (pipeline do worker com a imagem do próprio avatar) e `node tools/verificar-corpo.mjs` (sessão sintética de números, capturas antes e depois e ligar e desligar com a câmera falsa). Sem webcam real, o rastreamento ao vivo fica **NÃO TESTADO**: o roteiro do dono está em `Repertorio/TESTES-MANUAIS.md`.

## Painel do operador: onde fica cada coisa

Engrenagem do app: **Cena**, **Orçamento** (teto, modelo reserva, modo econômico, endereço do proxy), **Base de conhecimento**, **Modo evento** (modo livre ou guiada, limites de sessão, fila, pacote de áudio, avisos), **Armazenamento** e **Modo totem**. Fora do app: `laboratorio-vozes.html` (vozes) e `python serve.py` para servir. Linha de comando: `npm run ingest`, `npm run conhecimento`, `npm run guiada`, `npm run proxy`, `npm run orcamento`, `npm run importar-voz`.

## Laboratório de vozes e novos motores de voz

- **Laboratório (só do operador):** com `python serve.py 8771`, abra `http://localhost:8771/laboratorio-vozes.html` (não há link no app). Ele gera 13 frases fixas em cada voz candidata, mais uma repetição da primeira para medir estabilidade, mistura tudo **sem mostrar o nome da voz** e pede nota de 1 a 5 em naturalidade, clareza e pronúncia dos nomes (esta só nas frases com nomes). Mede o tempo do pedido até o áudio completo, a diferença de duração entre duas gerações e o custo por 1.000 caracteres (em reais, com câmbio editável). **Baixar JSON** e **Baixar relatório** guardam o resultado; coloque em `relatorios/voz/`. A recomendação por papel (ao vivo, pré-gravada, reserva, desligada) sai de limiares escritos no relatório e editáveis na página.
- **ElevenLabs, só pelo proxy local:** `ELEVENLABS_API_KEY=... npm run proxy` (o proxy aceita Gemini, ElevenLabs ou os dois). O navegador fala com `http://127.0.0.1:8890/elevenlabs/v1/text-to-speech/{voiceId}`; o proxy recusa modelo fora da tabela (Flash v2.5, Multilingual v2 e v3), texto vazio ou acima de 5.000 caracteres, e soma o gasto no mesmo teto do Gemini. **O plano gratuito do ElevenLabs só permite uso não comercial** (termos, seção 1c): uso no evento exige plano pago ou confirmação deles por escrito.
- **NaturalReader:** o site oficial não publica API (conferido em 07/10/2026). Entra como pré-gravação: exporte os MP3 e rode `npm run importar-voz -- adicionar --voz <rotulo> --texto "Frase exata" --arquivo x.mp3` (ou `lote` com uma lista). Os arquivos ficam em `assets/voz-importada/`, **fora do git**, indexados por hash de texto e voz.
- **Léxico de pronúncia:** `assets/lexico-pronuncia.json`, trocas de texto por motor (`de`, `para`, `motores`). Cada entrada nasce `validado: false` e só se confirma de ouvido no laboratório.

## Modo evento

Engrenagem, aba **Evento**.

- **Dois modos:** conversa livre (Gemini, base e voz) ou **demonstração guiada**: perguntas e respostas prontas, sem Gemini, sem custo e sem internet. As respostas guiadas **só entram depois de você aprová-las**:
  1. `node tools/guiada.mjs gerar luma ARQUIVO.md` copia os blocos "Pergunta: ... Resposta-base: ..." de um documento que já está em `knowledge/luma/`, com a fonte dele, e grava `knowledge/luma/guiada.json` com **todos `aprovado: false`**. O script nunca aprova sozinho nem escreve resposta.
  2. `node tools/guiada.mjs listar luma` mostra cada item; leia as respostas.
  3. `node tools/guiada.mjs aprovar luma --todos` (ou `--ids 1,2,3`) aprova.
  4. `npm run conhecimento` leva os aprovados para `knowledge/index.json`. Na tela, aparecem no máximo 8 como botões (mais que isso é parede de opções): aprove só os que quer mostrar.
- **Política de sessão:** "Perguntas por sessão" e "Minutos por sessão" (0 = sem limite). Ao chegar a um limite, a fala em curso termina, o personagem se despede e a sessão acaba. O motivo aparece nos avisos.
- **Fila visível:** o operador soma e tira pessoas; a tela de atração mostra "N pessoas na fila".
- **Pacote de áudio:** "Gerar áudio das respostas guiadas" sintetiza com a voz Kokoro e guarda em disco; depois toca mesmo com o servidor de voz fora do ar. **Só voz gratuita**: com a voz paga o botão recusa.
- **Escada de falhas** (cada degrau avisa o operador, com o ponto vermelho na engrenagem e a lista "Avisos do evento", e a conversa continua):
  1. Voz paga cai ou estoura o teto: Kokoro.
  2. Gemini falha, estoura a cota, fica lento (sem nenhum texto em 12 s) ou recusa a chave: modelo reserva (8 s) e depois a resposta pronta da base, com a fonte, mais a voz Kokoro.
  3. Internet cai: demonstração guiada com as respostas prontas (e o campo de texto some); volta sozinha quando a internet volta.
  4. Kokoro cai: voz do navegador, com aviso.
- **Botão de emergência:** o "Modo econômico" da aba Orçamento (só voz Kokoro e respostas prontas).

## Orçamento, teto e proxy local

- **Teto acumulado:** engrenagem, aba Orçamento, "Teto de gasto (R$)" (padrão R$ 50). O gasto de texto e o da voz Gemini paga somam num teto só, que **atravessa os dias**. Aos 80% a engrenagem ganha um ponto de aviso; no teto, o app passa sozinho ao **modo econômico** (voz Kokoro e resposta pronta da base, sem chamar o Gemini) e a criança vê só "agora só consigo responder o que já está pronto". "Modo econômico" também é um botão de emergência na mesma aba. O preço vem da tabela do diagnóstico (editável, com o câmbio).
- **Cadeia de modelos:** principal (`gemini-3.1-flash-lite`) → modelo reserva mais barato (`gemini-2.5-flash-lite`, editável) → resposta pronta da base com a fonte, quando houver base. A reserva só entra em erro de cota ou servidor fora do ar, e nunca depois de o personagem já ter começado a falar. Os ids foram conferidos na lista de modelos da API em 07/10/2026; se um dia sumir, troque na aba Orçamento (nenhum id está fixo no código além do padrão inicial).
- **Proxy local (chave fora do navegador):** `GEMINI_API_KEY=... TETO_REAIS=50 npm run proxy` (no PowerShell: `$env:GEMINI_API_KEY="..."; npm run proxy`) sobe um servidor em `http://127.0.0.1:8890`. Coloque esse endereço em "Endereço do proxy local" e a chave deixa de ser usada neste navegador para o texto. O proxy conta o gasto com os preços de `src/custo.js`, recusa modelo fora da tabela e origem não permitida, responde 429 no teto e **nunca grava nem escreve em log o corpo das perguntas nem a chave**. `GET /uso` mostra o acumulado. Não cobre a voz Gemini TTS (ainda usa a chave no navegador).
- **`npm run orcamento -- --estacoes 2 --sessoes-dia 120 --dias 2`** imprime o gasto previsto por plano (A mínimo, B com pré-gravação, C com voz paga em parte das respostas, D com voz paga em todas), com margem de 15% e contra o teto. Informe `--entrada` e `--saida` com os tokens médios medidos para sair da premissa.

## Uso offline e armazenamento

Depois de uma primeira visita **com internet**, o app abre sem ela: um service worker (`sw.js`) guarda a página, os personagens e as animações, e as bibliotecas da jsDelivr (todas com versão fixa na URL). Ele **nunca** guarda chamadas ao Gemini, ao servidor do Kokoro, POST nem pedido com chave de API. Fica desligado com `?debug`.

- **Painel:** engrenagem, "Armazenamento e uso offline": espaço usado e cota, armazenamento permanente, tamanho por categoria, "Baixar para offline" por personagem (só o personagem que já foi aberto fica pronto sozinho), apagar por categoria ou tudo.
- **Atualização:** uma versão nova do app instala e **espera**. O painel mostra "Atualizar agora"; nada reinicia no meio de uma conversa.
- **Limpar o cache:** pelo painel, ou nas ferramentas do navegador (Application, Storage, Clear site data).
- **Ao trocar um `.vrm`, `.vrma`, fonte ou imagem com o mesmo nome:** suba `BIN` em `sw.js` e `CACHE_BIN` em `src/armazenamento.js`, senão o navegador continua com o arquivo velho.
- **Áudio das frases fixas:** o cumprimento, a despedida e a amostra de voz (motor Kokoro) ficam guardados em disco, até 40 MB, e tocam mesmo com o servidor de voz fora do ar. A fala das respostas e a voz paga não são guardadas.
- **Bibliotecas hospedadas:** Three.js, os carregadores, three-vrm, wLipSync, mathjs (com as dependências), MediaPipe (câmera) e transformers.js com o runtime ONNX (Whisper e embeddings do RAG) ficam em `assets/vendor/` (cerca de 37 MB; origem, versão e licença em `assets/vendor/CREDITS.md`) e entram no cache `p3d-cdn`. Verificado no Chromium: nenhum pedido à CDN; câmera, embeddings do RAG, calculadora e boca funcionam; com o service worker o app abre sem internet.
- **Limite conhecido:** só o `kokoro-js` (motor opcional "Kokoro no navegador", inglês) ainda vem da CDN. Os **pesos** dos modelos de voz e de embeddings continuam vindo do Hugging Face na primeira vez (o Whisper e o E5 ficam no cache do navegador depois). Os arquivos de câmera e de voz só entram no cache offline depois de usados uma vez com internet.

## Modo totem e segurança

- **Modo totem** (configurações, Sessão): tela cheia no primeiro toque, engrenagem escondida e menu do botão direito bloqueado. Para voltar: segure o canto superior direito por 3 segundos ou aperte Ctrl+Shift+O.
- **CSP:** o `index.html` restringe de onde vêm scripts, conexões e imagens aos hosts que o app usa (jsDelivr, Gemini, Hugging Face e o servidor local do Kokoro). O importmap é um script inline, então a política leva o hash dele: depois de mexer no importmap rode `npm run csp`. O `npm run avaliar` confere.
- **Texto do modelo na tela:** sempre por `textContent`. O único `innerHTML` é um modelo estático da galeria.
- **Proxy da chave do Gemini:** não implementado. A chave fica no navegador, aceitável para protótipo pessoal; para uso público, ela precisa ir para um servidor.

## Avaliação das respostas

```bash
npm run avaliar:respostas                      # valida o banco de 20 perguntas por personagem e o detector. Gasto zero.
node tools/avaliar-respostas.mjs --gastar      # pergunta de verdade (gasta crédito do Gemini)
```

O detector (`src/frases-proibidas.js`) procura travessão, emoji, markdown, abertura genérica, pergunta repetida, "sou uma IA" sem terem perguntado, pedido de dado pessoal e marca de controle que vazou. As notas de voz, método, concisão e segurança são do dono, na tabela de `relatorios/avaliacao-respostas.md`.

## A trava "Agora só consigo responder o que já está pronto" (modo econômico)

Essa frase **não é um filtro de segurança**: é o **modo econômico**. Ele liga quando o interruptor "Modo econômico" da aba Orçamento está marcado **ou** quando o gasto acumulado chega ao teto. Nesse modo, a pergunta livre não chama o Gemini e só sai resposta pronta da base; sem base, sai a frase. Agora:
- a aba Orçamento mostra **por que** o modo está ligado (à mão, ou teto atingido com os valores) e tem o botão **Zerar o gasto acumulado**;
- a cada pergunta nesse modo, o operador recebe o aviso com o motivo (ponto na engrenagem e lista "Avisos do evento");
- a resposta pronta da base só vale se a pergunta for do assunto da base (antes, "história de dragão" pegava um trecho do ENSINAR).

## Base da Luma: UEMA e CTIC em linguagem infantil

- Fonte única: o PDF `knowledge/Base de Conhecimento RAG Expansiva - UEMA e CTIC.pdf`. Os 9 documentos `knowledge/luma/uema-infantil-*.md` (no repositório desde 08/10/2026, liberados pelo dono) são a versão simples para crianças: os de 01 a 08 vêm do PDF; o 09 traz as 10 perguntas oficiais (4 a 6 palavras) com as **respostas esperadas do dono, como ele as escreveu** (sem travessões). Em 4 pontos elas **divergem do PDF** (lema, Coordenadoria, Processo Seletivo Simplificado, mais de 20 cidades) e **não têm documento oficial que as confirme**; o dono decidiu usar as dele, e os documentos 01, 02, 03 e 06 foram alinhados a elas. Detalhes em `Repertorio/DIVERGENCIAS-UEMA.md`.
- `npm run conhecimento` valida os documentos e deriva do próprio texto o vocabulário do assunto: siglas (UEMA, CTIC, PAES...), nomes em CamelCase (SigUema, UemaNet, HelpDesk) e nomes próprios compostos das linhas "Pergunta:" (Campus Paulo VI). `ENSINAR` fica de fora (é palavra comum). Em modo complemento, só pergunta que cita um desses termos exige a base; o resto a Luma responde como sempre.
- **Pergunta do assunto sem a base preparada não vai ao Gemini** (ele inventaria): a Luma diz que não encontrou na base e o operador recebe o aviso. A base se prepara com "Preparar a base" (baixa o modelo de 118 MB na primeira vez) e **sozinha, ao abrir o app, se o modelo já estiver no cache do navegador**.
- **Teo e os outros não respondem sobre UEMA e CTIC**: mandam para a Luma, sem Gemini. Matemática do Teo segue normal.
- `node tools/benchmark-uema.mjs` indexa a base no Chromium e confere as 10 perguntas oficiais (assunto reconhecido, busca confiante, trecho certo em primeiro) e 7 perguntas gerais (nenhuma pode cair no assunto da UEMA). Gasta 0 de Gemini.
- Respostas da demonstração guiada (modo evento): `node tools/guiada.mjs listar luma` e `node tools/guiada.mjs aprovar luma --todos` (ou `--ids`), depois `npm run conhecimento`. Os 10 itens estão **pendentes de aprovação**.

## Base de conhecimento (RAG)

Cada personagem pode responder com base em documentos curados, citar de onde veio e dizer "não sei" quando a base não cobre. **Hoje a pasta `knowledge/` está vazia**: o app não inventa conteúdo, e sem documentos o personagem responde como sempre.

1. Crie `knowledge/<id do personagem>/` (por exemplo `knowledge/matematico/`) e coloque arquivos `.md` ou `.txt`.
2. Todo arquivo começa com o cabeçalho (sem ele o arquivo é recusado):

   ```
   fonte: de onde veio (documento, página ou endereço)
   licenca: licença ou permissão de uso

   # Título do documento
   ## Uma seção
   texto...
   ```

3. `npm run conhecimento` valida tudo e grava `knowledge/index.json`. **Rode sempre que mudar um documento.**
4. Engrenagem, aba "Personagem", "Base de conhecimento": **Preparar a base**. A primeira vez baixa o modelo de embeddings (`Xenova/multilingual-e5-small`, 118 MB, do Hugging Face) para o navegador e depois guarda. Só o arquivo que mudou é reindexado.
5. "Testar uma pergunta" mostra a semelhança de cada trecho. O **limiar de confiança** (padrão 0,86) decide quando o personagem diz que não sabe. Foi medido com o corpus da UEMA (dentro da base 0,876 a 0,929; outros assuntos 0,789 a 0,842), mas perguntas do assunto que a base não tem (telefone da reitoria, vestibular) ficam em 0,87 e passam: quem segura esse caso é a instrução ao modelo.

**Modo do personagem** (`conhecimento` em `src/characters.js`): `exclusivo` (padrão) responde "não sei" sempre que a base não cobre a pergunta. `complemento` (a Luma) só exige a base para perguntas do assunto dela; o resto o personagem responde como sempre. O assunto é reconhecido por um regex **derivado dos documentos** por `npm run conhecimento` (siglas com 2 ou mais ocorrências, sem RAG, TTS, PDF e FAQ) e gravado em `knowledge/index.json`: não é escrito à mão e muda quando os documentos mudam. Limite: pergunta do assunto sem nenhuma dessas siglas (por exemplo "onde fica a universidade?") é tratada como pergunta geral.

Como funciona: trechos de 150 a 300 palavras com o título preservado, busca por cosseno mais palavra-chave fundidas por RRF, e o texto recuperado entra no prompt como dado marcado (`<fonte>`), nunca como instrução. A resposta marca a fonte com `[fonte:id]` (não é falada) e a tela mostra "Fontes". Quando a base não cobre a pergunta o personagem responde "não sei" **sem chamar o Gemini**.

### Ingestão de documentos (PDF, PPTX, DOCX)

1. Coloque os arquivos em `knowledge/_inbox/` e rode `npm run ingest`. Cada um vira um `.md` em `knowledge/_revisao/`, com um relatório de qualidade ao lado (método e motivo, palavras, títulos e tabelas detectados, páginas sem texto, resíduos removidos). Camadas: MarkItDown para DOCX e PPTX; `pdfminer.six` por página para PDF (o MarkItDown não marca a página). O Docling (camada 2) **não está instalado** e o relatório só recomenda quando a estrutura sai quebrada. O PyMuPDF4LLM (AGPL-3.0) **não é usado**.
2. Abra o `.md` e preencha `fonte:`, `url:` e `licenca:` (saem como `PENDENTE`) e confira `nivel:` (`infantil`, `geral` ou `tecnico`). Leia o texto: o relatório não verifica fatos.
3. `python tools/ingest/ingerir.py aprovar ARQUIVO.md --para luma` move para `knowledge/luma/`, e só se nada estiver `PENDENTE`. Depois `npm run conhecimento` e "Preparar a base".
4. Mudou o arquivo de entrada? O manifest (`knowledge/_inbox/.manifest.json`, com hash) reprocessa só ele.
5. **Nuvem:** `llamaparse` (camada 3) e `infantil` recusam rodar sem a variável de ambiente da chave (`LLAMA_CLOUD_API_KEY`, `GEMINI_API_KEY`) e sem `--confirmo` para aquele arquivo. **O envio real não foi implementado**; os comandos só mostram a estimativa e as travas.

## Voz mãos-livres (experimental)

Opção em configurações, Sessão. **Vem desligada**; o botão de apertar para falar é o modo normal. Ligada, o microfone fica aberto durante a conversa: um detector de voz local (Silero VAD, `assets/vad/`, 13 MB) percebe quando a pessoa começa e termina de falar, o trecho vai para o Whisper do navegador (a primeira vez baixa o modelo) e vira a pergunta. Falar por cima do personagem o interrompe. Apertar o botão do microfone volta ao apertar para falar naquela sessão. Nada é gravado nem enviado. Use fone de ouvido: sem ele, o alto-falante pode ser entendido como fala. Os valores do detector (`src/maos-livres.js`) não foram calibrados com o barulho do local nem com crianças.

## Expressões

O LLM pode marcar uma frase com `[emo:alegre]` (nomes: neutro, alegre, pensativo, surpreso, curioso, empatico). A marca é tirada antes da voz e da tela e vira uma expressão suave no rosto; nome inválido vira neutro. Respiração e escuta ativa (inclinar a cabeça) precisam de clipes VRMA que ainda não existem.

## Quiosque: o que acontece quando algo quebra

Pensado para o totem ficar horas ligado sem ninguém olhando.

| Situação | O que o app faz |
|---|---|
| A GPU tira o contexto WebGL (driver atualizado, máquina suspensa, memória de vídeo no limite) | Para o laço, mostra "Um instante" e remonta o personagem quando o contexto volta, sem recarregar a página. Se não voltar em 8 s, oferece recomeçar. |
| O laço de renderização para de desenhar | O vigia (`src/vigia.js`) recarrega a página depois de 10 s parado. Aba oculta e máquina suspensa não contam como travamento. |
| Trava de novo depois de recarregar | Depois de 3 tentativas o app desiste e pede para chamar quem cuida do totem. |
| Erro de JavaScript que ninguém tratou | Vira linha no painel do operador. A tela do público não some por causa disso. |

Para testar sem esperar: engrenagem, Diagnóstico, "Testar queda de imagem". O botão derruba o contexto de verdade, com a extensão `WEBGL_lose_context`.

### Painel de diagnóstico

Na engrenagem, no fim das configurações. Só o operador vê; a versão do app não aparece em lugar nenhum da tela do público.

Mostra versão, tempo em pé, quadros por segundo, memória, uso da placa de vídeo, latência do Gemini, tempo até a primeira fala, gasto do dia, recargas automáticas, erros e o estado de cada serviço.

O gasto vem dos tokens que a própria API informa, convertidos pela tabela de preços de `src/custo.js` (lida em ai.google.dev/gemini-api/docs/pricing em 06/10/2026) e pela cotação do dólar, que é editável no painel. Modelo fora da tabela aparece só em tokens: o app não chuta preço.

### Teste de longa duração

```bash
node tools/maratona.mjs 4
```

Roda sessões simuladas em sequência pelo número de horas pedido, troca de personagem a cada 10 sessões e grava uma amostra por minuto em `relatorios/p9-maratona.json` (memória, FPS, geometrias, texturas, latência e erros). Sem `--real` o Gemini é simulado e nada sai para a internet. Ctrl+C encerra e grava o que já mediu.

### Acessibilidade

- Legenda do que o personagem fala sempre visível, em região `aria-live`.
- Alvos de toque de 44 px na tela do público, conferidos por teste em retrato e paisagem.
- Contraste conferido por teste em cada paleta (4,5:1 para texto, regra do WCAG 2.1).
- Anel de foco em todos os controles, com o Tab passando por eles.
- Modo calmo nas configurações, que também liga sozinho com "reduzir movimento" do sistema.

## Design

Direção visual, tipografia e paleta (com o motivo de cada escolha) em `DESIGN.md`. Desde 08/10/2026 todas as telas (atração, escolha do personagem, conversa e visualizador) usam o visual claro do Photo Booth: fundo claro, o nome do personagem repetido em contorno ao fundo, botões brancos em pílula e a cor de ação de cada personagem. A interface funciona em retrato (totem 1080×1920, celular) e em paisagem (avatar à esquerda, quadro e conversa à direita).

## Pendências conhecidas (sem suavizar)

Estado em 07/10/2026, ao fim do prompt 03 parcial (U1, U4, U5, U6 e U8; U2, U3 e U7 esperam você).

**Não verificado contra o serviço de verdade**
- **Gemini real:** o AI Studio está com teto de R$ 7, então nada desta fase falou com o Gemini de verdade: o proxy contra o Google, a cadeia de modelos, a escada de falhas do modo evento e `gemini-real.spec.js` foram verificados só com Gemini simulado. A tabela "previsto contra medido em 30 turnos reais" não foi feita.
- **ElevenLabs e NaturalReader:** sem chave e sem MP3 exportado; só o proxy contra um servidor falso e o laboratório com Kokoro real. As notas de ouvido do laboratório não existem ainda (quem avalia é você).
- **Pacote de áudio do modo evento** com o Kokoro: não testado.
- **Voz mãos-livres:** o pedido de áudio de fala real e a interrupção ficam NÃO TESTADOS (só com áudio de fala falso).

**Conteúdo da UEMA (U2, U3, U7)**
- Nenhum fato foi verificado. O PDF do corpus foi compilado por IA, não traz endereços de fonte e a licença não foi informada; o dono liberou o corpus no repositório em 08/10/2026 (`knowledge/luma/` e o PDF), então os textos são públicos e **continuam sem fonte oficial verificada**. U2 (corpus oficial), U3 (atividades sobre a UEMA) e U7 (ensaio e avaliação) dependem de documentos oficiais e de aprovações suas.
- O limiar do RAG não segura perguntas do assunto da UEMA cuja resposta a base não tem (telefone, vestibular, reitor). Perguntas da UEMA sem nenhuma sigla ("onde fica a universidade?") são tratadas como gerais e o modelo pode inventar. Quem segura é a instrução ao modelo, não uma trava.
- **Respostas guiadas:** nenhuma aprovada. O FAQ do PDF tem 36 itens e alguns são instruções para o agente.

**Ingestão**
- O envio real à nuvem (LlamaParse e a versão infantil com o Gemini) **não foi implementado**: os comandos só mostram estimativa e travas. Não há aprovação de versão infantil funcionando nem filtro por nível no RAG.

**Voz e animação**
- Os motores `elevenlabs` e `importado` existem no adaptador, mas não estão ligados à tela de configuração nem a um personagem; o `voiceId` de cada personagem depende do relatório do laboratório.
- O proxy não cobre a voz Gemini TTS (ela ainda usa a chave no navegador).
- **Clone novo sem animações:** o catálogo `animacoes.json` aponta para `aceno*.vrma` (Mixamo) e `VRMA_MotionPack/...` (VRoid), que não podem ir ao git. Num clone novo esses clipes dão 404 no console e o app usa o idle. O pacote novo em `assets/animations/` ainda precisa ser catalogado por folha de contato.
- Respiração e escuta ativa continuam sem clipes.

**Testes**
- A suíte completa não foi rodada depois das últimas edições (adiada a seu pedido). `p12` e M6.1 já estouraram o tempo só na rodada completa, sem causa investigada.
- Os 65 itens do roteiro manual (`Repertorio/TESTES-MANUAIS.md`) não foram executados por você.

**Outras**
- As bibliotecas (Three.js, three-vrm, wLipSync, mathjs, MediaPipe e transformers.js) já são locais (`assets/vendor/`). **Ainda na CDN:** só o kokoro-js (motor opcional em inglês). O Whisper foi religado ao transformers.js local mas **não foi testado com o modelo** (só os embeddings do RAG, que usam o mesmo carregador).
- **Três testes e2e falham mesmo sem as mudanças da hospedagem local** (confirmado desfazendo-as): `app.spec.js` M1 (espera 5 filhos na cena e há 6) e M2, e `p13-visualizador` "galeria abre o visualizador tocando os clipes". Não investigados.
- Cache de respostas do Gemini: não feito.
- Prompt 07: feitos V0 a V6 e a tela do Photo Booth (V1); faltam o V7 (adaptar, endurecer, otimizar, polir, auditar) e o V8 (fechamento). Pernas experimentais não foram feitas. Webcam real e mão real: NÃO TESTADO.
- Decisões antigas suas: `MAX_RODADAS` do Rafa, aceno do Mixamo, eSpeak (GPL), `PROPOSTA-SKILL-VRM.md` e `references/` da skill vrm-avatar-web.

## Testes

```bash
npm install
npx playwright install chromium
npm test
```

- **Unitários** (`tests/unit`): o divisor de frases e o leitor do streaming do Gemini.
- **Ponta a ponta** (`tests/e2e`, Playwright): abrir, trocar personagem sem vazar memória, falar com o Kokoro, Parar, e cair para a voz do sistema.
- **Gemini simulado:** nos testes ele é sempre simulado, e nenhuma chamada sai para a internet.
- **Kokoro real:** os testes usam o servidor de verdade. Se ele estiver fora do ar, o teste de voz é pulado.

Abrir o app com `?debug` na URL expõe `window.__prof3d` para inspeção no console.
