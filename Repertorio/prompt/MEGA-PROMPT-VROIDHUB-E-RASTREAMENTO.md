# PROMPT 07: visual de Photo Booth (estilo VRoid Hub), entrada diferente por personagem e rastreamento do corpo

> **Pasta de referência:** tudo fica em `repertorio/`.
> - `repertorio/REPERTORIO.md` é a fonte de verdade (leia a seção 32 desta rodada).
> - `repertorio/ui/03-vroidhub-photobooth.png` é a captura de referência desta tela (o dono salva a imagem com esse nome).
> - Rode este prompt **depois do 06** (visualizador com câmera, reset, tela cheia e loop).

---

Responda e comente em português do Brasil.

## PAPEL

Você é um engenheiro front-end sênior com olho de direção de arte e experiência em visão computacional no navegador. O app já tem o visualizador do prompt 06. Agora o trabalho é **só a tela do visualizador**: deixá-la visualmente parecida com o Photo Booth do VRoid Hub, dar a **Luma** e ao **Teo** uma amostra de entrada **diferente**, e acrescentar **rastreamento do corpo sem ser a cabeça**: braços, mãos e dedos, tronco e movimento.

A tela de seleção estilo jogo (prompt 05) **não muda**. As duas telas compartilham tipografia, raios e tokens, e cada personagem mantém o seu acento.

## PASSO 0: LEIA, OLHE E AUDITE

1. Leia `repertorio/REPERTORIO.md` (seções 3, 7, 25, 28 e 32) e `repertorio/PROGRESSO.md`.
2. **Olhe a captura** `repertorio/ui/03-vroidhub-photobooth.png`. Confirme a leitura da seção 32.1, corrija o que estiver errado, **amostre a paleta** (hexadecimal) e registre em `repertorio/REFERENCIAS-UI-INDEX.md`.
3. **Skills.** Diga quais usou e em que etapa:

| Etapa | Skill | Uso |
|---|---|---|
| Plano | `impeccable shape`, `design-taste-frontend` | Planejar a tela antes de codar. Linha "Design Read" e os três botões. Tela do personagem é modo *Experience*; painel do operador é *Operate*. |
| Câmera e entrada | `threejs-interaction`, `threejs-fundamentals` | OrbitControls, teclado, toque, canvas responsivo, limpeza de memória. |
| Animação | `threejs-animation`, `vrm-avatar-web` | Mixer, crossfade, `LoopOnce`, ordem de atualização, catálogo de clipes, licença no carregamento. |
| Acabamento | `impeccable animate`, `adapt`, `harden`, `optimize`, `polish`, depois `audit` | Nessa ordem; só então `npx impeccable detect .` |

   Não existe skill para rastreamento de corpo. **Leia a documentação oficial do MediaPipe (Pose, Hand, Holistic) antes de escrever código** e confira os nomes de opções, em vez de usar a memória.
4. **Linha de base:** FPS de render com câmera desligada, tempo de carga e memória após 10 trocas de personagem.
5. Liste o que já existe (visualizador, galeria de animações, módulo de webcam, painel do operador, medidor). **Estenda; não reescreva.**

## REGRAS QUE CONTINUAM VALENDO

- Só `.vrm` e `.vrma` prontos. Nenhuma pose **escrita** em código (exceção única do aceno procedural do prompt 04, só com aprovação).
- **Rastreamento é diferente de pose autoral:** o movimento vem **ao vivo do corpo do usuário**, não de uma pose inventada. É permitido, mas sempre opcional e desligado por padrão.
- Sem cara de IA (seção 10). Sem travessão (—). Textos em `strings.pt-BR.js`. Movimento da interface só em `transform` e `opacity`. `prefers-reduced-motion` respeitado.
- Selos `TESTADO` / `NÃO TESTADO`. Não invente API. Verificação em passes limitados.
- Crianças: nada de nome, escola, gravação de áudio ou de imagem.

## REGRAS NOVAS

**V1. Inspiração, não cópia.** Não use a marca "VRoid Hub", o logotipo, o texto do padrão de fundo, os ícones nem a redação da tela. Nada na interface pode sugerir que a pixiv ou o VRoid apoia ou recomenda o evento. O padrão de fundo usa o nome do projeto ou do personagem.

**V2. Câmera ligada só por ação explícita.** Desligada por padrão, indicador visível, **nenhum frame gravado, salvo ou enviado**, tracks paradas ao desligar. Pré-visualização da câmera é opcional e desligada por padrão. Modelos do MediaPipe hospedados localmente.

**V3. Foto e vídeo capturam só o avatar.** Nunca a imagem da webcam. Salvam localmente, sem envio. Ficam **desligados no modo público** e ligáveis pelo operador. Só habilitam se a licença do `.vrm` e a do clipe em uso permitirem o uso previsto, e mostram o crédito exigido.

**V4. Sem links externos no modo público** (quiosque). O link para achar `.vrma` aparece só no painel do operador.

## TELA: PHOTO BOOTH

Estrutura de referência (paisagem). Descrição completa na seção 32.1 do REPERTORIO.

- **Fundo claro** com um padrão de letras grandes em contorno, repetido e cortado pelas bordas, com contraste mínimo, decorativo (`aria-hidden`), sem animação.
- **Centro:** o personagem de corpo inteiro, com sombra de contato suave.
- **Esquerda:** faixa vertical de **miniaturas de animações**. A selecionada tem contorno na cor de acento. Um cartão "..." abre a lista completa. As miniaturas são **renderizadas do próprio `.vrm`** (um quadro de cada clipe), geradas uma vez e guardadas em cache (IndexedDB). Navegação por teclado.
- **Direita:** painel branco flutuante de canto arredondado com abas: **Animações**, **Expressões**, **Rastreamento**, **Fundo e foto**.
  - *Animações:* lista suspensa com o clipe atual, modos de loop (repetir um, todos, aleatório), velocidade, e no painel do operador o botão "Selecionar `.vrma`" (arquivo local, validado e marcado como temporário até aprovação).
  - *Expressões:* ver abaixo.
  - *Rastreamento:* ver abaixo.
  - *Fundo e foto:* cor de fundo (amostras da paleta do personagem e transparente), moldura visível, tamanhos 1:1, 4:5, 16:9 e 9:16.
- **Topo à direita:** botão de pausa. **Embaixo à direita:** dois botões em pílula, foto e vídeo (ver V3).
- **Retrato:** o painel vira folha inferior, e a faixa de miniaturas fica horizontal.
- Alvos de toque de 56 px ou mais, contraste AA, foco visível, rótulos acessíveis, atalhos de teclado documentados.

## ENTRADA DIFERENTE PARA LUMA E TEO

Dados por personagem em `characters.js`:
`amostraEntrada: { clipe, modo }` e `loopAnimacoes: [ids]`.

- Ao abrir o visualizador, cada personagem toca **o seu** clipe de entrada, **em loop** (ou uma vez e depois o loop da lista, conforme `modo`), até o usuário escolher outro. O botão de pausa congela o quadro.
- **Luma e Teo precisam ter entradas diferentes.** Proponha a atribuição com base no catálogo de clipes ativos e no jeito de cada um (por exemplo, a Luma com um clipe de cumprimento ou apresentação, o Teo com uma pose mais contida). O padrão do VRoid Hub é abrir em "Model pose". Pode ser o ponto de partida, mas não pode ser igual para os dois. **Eu aprovo a atribuição antes de fixar.**
- Só usa clipes `ativos` e marcados "ok para criança" no modo infantil. Sem clipe disponível, cai para `idle` e registra a lacuna.
- Crossfade de 0,3 s. Pausa com a aba oculta.

## ABA EXPRESSÕES

- Controles de 0 a 100 para as expressões que o `.vrm` realmente tem (confira com o checklist: `happy`, `angry`, `sad`, `relaxed`, `surprised`, `neutral` e as demais presentes). Botão "zerar".
- Interruptor **"Olhar para a câmera"** (usa `vrm.lookAt`). Desligado, permite escolher a direção do olhar. O dono do olhar é um só: ou o clipe, ou o seu código.
- As expressões do usuário **sobrescrevem** as do clipe durante a reprodução. Prioridade: lip sync, depois expressão manual, depois trilhas do clipe.
- Modo público: 6 botões com ícones. Modo operador: controles de 0 a 100.

## FOTO E VÍDEO

- Foto em PNG a partir do canvas, com fundo escolhido ou transparente, no tamanho e na moldura selecionados. Contagem regressiva curta.
- Vídeo a partir do canvas (`captureStream` e `MediaRecorder`), com limite de duração configurável (sugestão: 15 s) e indicador de gravação. Confira o formato suportado em cada navegador e avise se não houver suporte.
- Salvar local, nome de arquivo sem dados pessoais. Nada é enviado.

## RASTREAMENTO DO CORPO (SEM SER A CABEÇA)

Objetivo: o personagem acompanha **braços, antebraços, mãos e dedos, tronco e movimento** de quem está na câmera. A cabeça e o rosto continuam no módulo de webcam que já existe (olhar, expressões). Não duplique esse módulo.

### Tecnologia
- `@mediapipe/tasks-vision` (versão fixada, WASM e modelos locais). Pose Landmarker (33 pontos, coordenadas normalizadas e coordenadas de mundo em metros, com visibilidade e presença por ponto) e Hand Landmarker (21 pontos por mão). Existe também o Holistic Landmarker (pose, mãos e rosto numa tarefa só).
- **Decida por medição**, não por gosto: compare "Pose + Hand" com "Holistic" no computador-alvo (FPS, latência, uso de CPU e GPU, tremor) e justifique a escolha. Use o modelo mais leve que atenda.
- Rodar a inferência **fora da thread principal** (Web Worker). A documentação do MediaPipe recomenda isso para não travar a tela. O render continua a 60 fps; o rastreamento roda a 15 a 30 fps, com interpolação entre amostras.

### Retarget para o VRM
- Use os **ossos humanoides normalizados** do VRM, para funcionar em qualquer modelo.
- **Por direção, não por posição:** para cada segmento (ombro para cotovelo, cotovelo para pulso, pulso para dedos), calcule a rotação que alinha a direção de repouso do osso do VRM com a direção observada nas coordenadas de mundo. Assim, o tamanho dos braços do modelo não importa e não precisa de IK.
- **Dedos:** flexão de cada dedo a partir dos ângulos entre as articulações da mão, aplicada às falanges do VRM. O polegar tem tratamento próprio.
- **Tronco:** guinada, inclinação e rotação pequenas a partir da linha dos ombros e do quadril, **limitadas** (sugestão: até cerca de 20 graus), distribuídas entre coluna, peito e peito superior.
- **Ombros:** encolher ombros leve, limitado.
- **Movimento do corpo:** deslocamento lateral e de profundidade do quadril do avatar a partir da posição e da escala do corpo na imagem, com **zona morta**, limites curtos (sugestão: cerca de 30 cm para os lados e 20 cm em profundidade) e retorno suave ao centro.
- **Pernas:** desligadas por padrão e marcadas "experimental". Quem usa o app costuma estar com o corpo cortado na câmera. Pés travados no chão.
- **Espelho:** por padrão o avatar age como um espelho (a sua mão direita move o braço que aparece do lado direito da tela). Interruptor para o modo direto. **Teste os dois** e confira a lateralidade com VRM 0.x e 1.0 (o 0.x precisa de `VRMUtils.rotateVRM0`).
- **Ordem por quadro:** `mixer.update(dt)`, depois a **sobreposição do rastreamento** nos ossos habilitados, depois `vrm.update(dt)`, depois `controls.update()`.

### Qualidade e segurança do movimento
- Filtro de suavização (One Euro ou equivalente) por ponto ou por osso, com parâmetros em configuração. Limite de velocidade angular.
- **Limites de articulação:** cotovelo sem hiperextensão, ombro dentro de faixa plausível, braço sem atravessar o tronco (verificação simples de distância mínima ao peito).
- **Confiança:** abaixo do limiar de visibilidade por N quadros, a parte sai gradualmente do rastreamento e volta ao clipe ou ao `idle` em 300 ms. Ao reaparecer, entra de novo com a mesma suavidade.
- **Peso por parte do corpo (0 a 1):** braços, mãos e dedos, tronco, movimento, pernas. Cada um com interruptor.
- **Calibração:** "Fique em pose neutra por 2 segundos" define a linha de base de tronco e centro. Botão e atalho para recalibrar.

### Gestos que disparam clipes (não é captura de movimento)
- **Aceno do usuário** (pulso oscilando acima do cotovelo) faz o personagem **acenar de volta** com o clipe de aceno.
- **Mão levantada** faz o personagem convidar a pergunta ("Pode perguntar"), respeitando o limite de 2 perguntas por criança.
- **Joinha** dispara o gesto de alegria, se existir clipe.
- Exigem N quadros consecutivos, têm intervalo mínimo entre disparos e interruptor. Só funcionam com a câmera ligada.

### Aba Rastreamento
- Interruptores: Braços, Mãos e dedos, Tronco, Movimento do corpo, Pernas (experimental), Espelho, Gestos. Botões: Recalibrar, Pré-visualização da câmera (com o esqueleto desenhado, local e desligada por padrão), Qualidade (Leve ou Equilibrada).
- **Modo público:** um único interruptor "Imitar meus movimentos", com a instrução de calibração em uma frase.
- Estado visível: câmera ligada, rastreando, perdeu o corpo, calibrando.

### Desempenho
- Tudo medido contra a linha de base do Passo 0: FPS de render com rastreamento ligado, **latência da câmera até o avatar** (meta sugerida: abaixo de 150 ms), uso de CPU e GPU.
- Qualidade adaptativa: com FPS baixo, reduz taxa de inferência, desliga dedos, depois pernas e movimento, nessa ordem, e avisa o operador.
- Pausar o rastreamento com a aba oculta. Sem vazamento ao ligar e desligar 20 vezes.

## COMO TESTAR SEM A WEBCAM

O ambiente do Cowork não tem sua câmera. Faça assim:
- **Testes unitários do retarget** com landmarks sintéticos: braço levantado 90 graus, braço à frente, mão aberta e fechada, espelho ligado e desligado, limites de articulação, queda e retorno de confiança. O osso deve ficar na direção esperada dentro de uma tolerância.
- **Gravador e repetidor de landmarks:** ferramenta do painel do operador que grava **apenas números** (nunca vídeo) de uma sessão real e os repete no pipeline. Serve para teste de regressão e para eu enviar uma sessão curta para você ajustar.
- **Roteiro manual** em `repertorio/TESTES-MANUAIS.md` para o dono: lateralidade, dedos, calibração, perda do corpo, gestos, FPS e latência.

## O QUE FAZER, EM MARCOS

Um marco por vez. Atualize o `repertorio/PROGRESSO.md` a cada um.

| Marco | Conteúdo | Aceite |
|---|---|---|
| V0 | Leitura, skills, linha de base, paleta amostrada | Registro em `REFERENCIAS-UI-INDEX.md` |
| V1 | Layout do Photo Booth (painel, faixa de miniaturas, pausa, botões, fundo em contorno, retrato) | **Wireframes aprovados por mim**; capturas em retrato e paisagem |
| V2 | Entrada diferente para Luma e Teo, loops por personagem | **Atribuição aprovada por mim**; sequência de capturas |
| V3 | Aba Expressões, olhar para a câmera | Capturas e teste de prioridade |
| V4 | Foto, vídeo, fundo, moldura, licença | Arquivos gerados e teste de bloqueio por licença |
| V5 | Rastreamento: pipeline, calibração, braços, tronco, filtros, queda de confiança | Testes sintéticos e relatório de FPS e latência |
| V6 | Mãos e dedos, movimento do corpo, gestos, pernas experimentais desligadas | Testes sintéticos e repetição de landmarks |
| V7 | `adapt`, `harden`, `optimize`, `polish`, `audit` e o detector | Relatório de desempenho e de acessibilidade |
| V8 | README, `PROGRESSO.md`, seção 12 do REPERTORIO, entrada 03 do índice | Pendências sem suavizar |

## O QUE NÃO FAZER

- Não usar marca, logotipo, texto de padrão nem ícones do VRoid Hub, nem sugerir apoio da pixiv.
- Não gravar, salvar ou enviar imagem da webcam. Foto e vídeo só do avatar.
- Não ligar a câmera sem ação explícita.
- Não escrever pose em código; o movimento vem do usuário.
- Não duplicar o módulo de webcam do rosto.
- Não deixar `try/catch` vazio.
- Não afirmar que o rastreamento funciona sem teste: sem webcam, o selo é `NÃO TESTADO` e o roteiro vai para o dono.

## RELATÓRIO FINAL

1. Linha de base e resultado (FPS, latência, memória).
2. Marcos com selo `TESTADO` ou `NÃO TESTADO`.
3. Paleta amostrada e a atribuição de entrada de Luma e Teo.
4. Decisão "Pose + Hand" ou "Holistic", com os números.
5. Capturas em retrato e paisagem.
6. O que o dono precisa testar com a webcam (`TESTES-MANUAIS.md`).
7. Skills usadas e as que faltaram.
8. Problemas conhecidos, sem suavizar.
