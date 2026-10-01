# REPERTORIO.md — Professora 3D (versão multi-personagem)

Arquivo de referência do projeto. A IA lê isto **antes** de escrever código e atualiza a seção 12 sempre que descobrir algo novo.
Pesquisa feita em 30/09/2026 e 01/10/2026. Seções 13 a 19 vieram na segunda rodada; 20 a 24 (tema UEMA, ingestão, vozes, orçamento, modo evento) na terceira; 25 a 27 (animação de aceno, profissionalização, skills) na quarta; 25.1b a 25.7 (mais ferramentas de VRMA, ativos do dono, catálogo por caso de uso, aceno simples) na quinta. Cada item tem um selo:

- **[VERIFICADO]** encontrado em fonte pública nesta pesquisa
- **[CONFERIR]** plausível, mas a IA deve confirmar (npm view, teste real) antes de depender disso
- **[SUGESTÃO]** ideia minha, não é fato

---

## 1. Decisões já tomadas

| Tema | Decisão | Motivo |
|---|---|---|
| Avatar | Só arquivos `.vrm` prontos, em `assets/avatars/`. Nunca gerar, modelar ou aproximar personagem em código. | Pedido do dono do projeto. |
| Ready Player Me | **Não usar.** | [VERIFICADO] O serviço foi encerrado em 31/01/2026 após a compra pela Netflix. Avatares hospedados e a API pararam de funcionar. Além disso ele exporta GLB, não VRM. |
| Renderização | Three.js + `@pixiv/three-vrm` no navegador | Já é a base do arquivo atual. |
| Voz | Kokoro (ver seção 5, há uma pegadinha grande com português) | Pedido do dono do projeto. |
| Cérebro | Gemini (já existe no arquivo). Trocável por adaptador. | Manter o que funciona. |
| Webcam | MediaPipe Face Landmarker, tudo local | [VERIFICADO] Devolve 478 pontos e 52 blendshapes por rosto, e roda no navegador via `@mediapipe/tasks-vision`. |

---

## 2. Onde conseguir `.vrm` prontos

| Fonte | Licença | Observação |
|---|---|---|
| **Open Source Avatars / 100Avatars** (opensourceavatars.com) | [VERIFICADO] CC0: uso comercial livre, sem atribuição obrigatória | Melhor ponto de partida. Botão "Download VRM" em cada avatar. |
| Lista "200 CC0 Avatars" dentro do repositório `madjin/awesome-cc0` | [VERIFICADO] CC0, formatos VRM e FBX | Mesma origem do item acima, mais volume. |
| VRoid Hub (hub.vroid.com) | **Varia por modelo.** | Ler a licença de cada modelo. Muitos proíbem redistribuir o arquivo. |
| **Samples do VRoid Studio (VRoidPreset_A a Z, incluindo AvatarSample_A, B e C)** | [VERIFICADO na página oficial, atualizada em 26/12/2024] Os arquivos `.vroid` e `.vrm` podem ser usados por qualquer pessoa, com ou sem fins lucrativos, **sem crédito obrigatório**. **Não são CC0.** Proibido: redistribuir o arquivo marcando-o como CC0, redistribuir o arquivo cobrando por ele, criar serviço de criação de personagens com os dados, e agir de modo que **sugira que a pixiv apoia ou recomenda um produto ou evento**. As condições podem mudar. | Uso no evento da UEMA é permitido. Não escrever "apoio da VRoid/pixiv" em lugar nenhum. Conferir a página de novo perto do evento. |
| Samples antigos do VRoid (HairSample_Male, HairSample_Female, β Ver AvatarSample_1 a 4) | [VERIFICADO] CC0 | Também servem. São de outra geração de modelos. |
| VRoid Studio | O usuário faz o personagem no editor e exporta `.vrm` | Só se o dono quiser criar. A IA não faz isso. |

**Regra para o repositório:** se o `.vrm` não for CC0, não commitar o arquivo. Deixar em `.gitignore` e registrar autor e licença em `assets/avatars/CREDITS.md`.

**Checklist ao receber um `.vrm`** (a IA valida no carregamento e loga o resultado):
1. Tem `expressionManager` com `aa`, `ih`, `ou`, `ee`, `oh`, `blink`?
2. Tem `happy`, `sad`, `surprised`, `relaxed`, `angry`? (usadas nas reações)
3. Tem humanoid com `head`, `neck`, `leftUpperArm`, `rightUpperArm`?
4. É VRM 0.x ou 1.0? (0.x precisa de `VRMUtils.rotateVRM0`)
5. Tamanho do arquivo. Acima de ~20 MB, avisar.

---

## 3. Animação do corpo (sem animar na mão)

O arquivo atual só gira a cabeça e força os braços com `rotation.z = ±1.2`. Isso quebra em modelos com proporções diferentes.

- **VRMA** é o formato de animação do ecossistema VRM. [CONFERIR] Pacote `@pixiv/three-vrm-animation` (`VRMAnimationLoaderPlugin`, `createVRMAnimationClip`). Confirmar nome e versão com `npm view`.
- [VERIFICADO] O projeto VRoid distribuiu 7 arquivos VRMA gratuitos na BOOTH (2024). O repositório `arpahls/avatar` os usa e cita o crédito ao VRoid Project / pixiv. Ler a licença antes de redistribuir.
- Mixamo → VRM exige retarget. [SUGESTÃO] Só entrar nisso se os VRMA gratuitos não bastarem.
- Animações mínimas por personagem: `idle` (respiração e balanço leve), `talk` (gesto discreto), `think` (olhar para cima e mão no queixo, se existir), `greet`. Se faltar clipe, cair para idle. **Não inventar pose por código**, com uma única exceção: o aceno simples procedural da seção 25.7, só com aprovação explícita do dono e como último recurso.

---

## 4. Stack e versões

Fixar tudo com versão exata. Nada de `@3` ou `latest`.

| Peça | Estado atual no arquivo | Ação |
|---|---|---|
| three | 0.169.0 (importmap) | [CONFERIR] manter ou subir, testando |
| @pixiv/three-vrm | 3.5.5 (importmap) | [CONFERIR] rodar `npm view @pixiv/three-vrm version` e validar |
| @huggingface/transformers | `@3` sem pin (Whisper fallback) | **Trocar por versão exata** |
| kokoro-js | não usa | [VERIFICADO] última na busca: 1.2.1 |
| @mediapipe/tasks-vision | não usa | [CONFERIR] pinar versão do pacote **e** do WASM/modelo |
| wlipsync | não usa | [VERIFICADO] existe no npm, MIT, port do uLipSync |

Servir por HTTP (`python -m http.server` ou `npx serve`). `fetch` de `.vrm`, WASM e câmera não funcionam bem em `file://`. A câmera exige contexto seguro; `localhost` conta.

---

## 5. Voz: Kokoro e o problema do português

**Achado importante.** Kokoro-82M tem 3 vozes em português brasileiro: `pf_dora` (feminina), `pm_alex` (masculina), `pm_santa` (masculina). [VERIFICADO] em vários projetos que usam o modelo.

**Mas** a biblioteca de navegador `kokoro-js` (1.2.1) só expõe vozes de inglês (en-US e en-GB). [VERIFICADO] por um relato de terceiros que leu o `voices.js` do repositório: as entradas `pf_dora`, `pm_alex` e `pm_santa` estão comentadas, e a validação recusa qualquer voz fora da lista ativa. Fonte primária não abri diretamente, então a IA **precisa rodar `tts.list_voices()` e confirmar**.

Caminhos, em ordem de preferência para este projeto:

1. **Kokoro-FastAPI local** (`remsky/Kokoro-FastAPI`, Docker CPU ou GPU). [VERIFICADO] Compatível com a API de fala da OpenAI, porta 8880: `POST /v1/audio/speech` com `{ model:"kokoro", input, voice:"pf_dora", response_format, speed }`. Lista vozes em `GET /v1/audio/voices`. Suporta mistura de vozes em `/v1/audio/voices/combine`. Tem endpoint de timestamps por palavra (`/dev/captioned_speech`), mas [VERIFICADO] há issue aberta relatando `timestamps: null`. **Não depender disso.**
2. **sherpa-onnx com Kokoro multilíngue** (`kokoro-multi-lang`). [VERIFICADO] A documentação lista `pf_dora`, `pm_alex`, `pm_santa` nos índices de voz. É o caminho se o dono quiser tudo no navegador, com mais trabalho de integração WASM. [CONFERIR] se há build web pronto.
3. **kokoro-js no navegador** só se `list_voices()` mostrar português. Se não mostrar, usar apenas como voz em inglês (o personagem "professor de inglês" pode usar `af_*` ou `bf_*`).
4. **Web Speech API** (o que existe hoje) como último recurso, com aviso na interface.

Como só há 3 vozes PT-BR, personagens vão compartilhar voz. Diferenciar por `speed` e, no FastAPI, por mistura de vozes. [SUGESTÃO] Kokoro não tem controle de pitch.

Cuidados:
- CORS: testar a chamada do navegador ao `localhost:8880` antes de assumir que funciona.
- Tocar o áudio por `AudioContext` (não `<audio>` solto), porque o lip sync precisa do nó de áudio.
- Fila de sentenças: sintetizar a frase N+1 enquanto a N toca.
- Um botão "parar" que cancela fila, requisição e áudio.

---

## 6. Lip sync

O arquivo atual move a boca com `Math.sin` misturado. Não tem relação com o áudio.

Do mais simples ao mais fiel:

1. **RMS do áudio → `aa`.** [VERIFICADO] Serie de artigos no DEV.to (autor orca_forge) sobre VRM no navegador: abrir/fechar a boca pela intensidade já parece razoável, e não precisa sincronizar com o texto porque usa o áudio que está tocando. Limite conhecido: não faz lábios fechando em "m", "b", "p".
2. **Vogais por MFCC com `wlipsync`.** [VERIFICADO] Devolve pesos `A E I O U` e volume por frame; mapeamento usual `A→aa, E→ee, I→ih, O→oh, U→ou`. Exige um **perfil** (`profile.json`). [CONFERIR] Se o perfil padrão serve para o português falado pelo Kokoro. Testar ouvindo e olhando, não assumir.
3. Ajustes finos: suavização independente de frame rate, gate no silêncio, teto por vogal (os visemas de cada modelo têm força visual diferente).

Estratégia: implementar o 1, medir, e só subir para o 2 se ficar melhor de verdade. Sempre manter o 1 como fallback.

---

## 7. Webcam (interação)

**Ferramenta:** MediaPipe Face Landmarker (`@mediapipe/tasks-vision`). [VERIFICADO] 52 blendshapes estilo ARKit + matriz de transformação facial (para pose da cabeça).
**Alternativa:** Kalidokit. [VERIFICADO] Resolve rosto, olhos, pose e mãos a partir de landmarks e já tem exemplo com three-vrm. É mais antigo e voltado para o Holistic. [CONFERIR] compatibilidade com `tasks-vision`.
**Referências de implementação:** `DarkStar1997/vtubing` e `hjosugi/minamo-project` mostram o pipeline webcam → MediaPipe → VRM com filtro One Euro para suavizar tremor. [VERIFICADO]

Usos que agregam (em vez de enfeite):

| Uso | O que faz | Risco |
|---|---|---|
| Presença | Rosto aparece → personagem cumprimenta. Sem rosto por N segundos → volta ao idle. | Baixo |
| Olhar | Cabeça e olhos do avatar seguem a posição do rosto na tela (`vrm.lookAt`). | Baixo |
| Modo espelho | Avatar copia sorriso, boca, piscada e cabeça de quem está na câmera. Modo opcional, brincadeira. | Médio: calibrar e suavizar |
| Reação | Sorriso forte → avatar sorri de volta. | Baixo |
| Sinal de dúvida | Testa franzida e olhar parado por vários segundos → "quer que eu explique de outro jeito?" | **Alto:** falso positivo irrita. Marcar experimental, com limiar ajustável. |

Regras de privacidade (o público inclui crianças):
- Câmera **desligada por padrão**. Ligar exige clique explícito.
- Indicador visível enquanto a câmera está ativa.
- Nenhum frame é gravado, salvo ou enviado para API. Só números viram estado local.
- Ao desligar, parar as tracks (`stream.getTracks().forEach(t => t.stop())`).
- Limitar a ~15–30 inferências/s e pausar com a aba oculta.

---

## 8. Skills para usar (Claude Code, Codex, Cursor)

### Anti-slop de design
| Skill | Instalação | Notas |
|---|---|---|
| **impeccable** (`pbakaus/impeccable`) | `npx impeccable install`, depois `/impeccable init` dentro da ferramenta. Alternativa: `npx skills add pbakaus/impeccable` | [VERIFICADO] 1 skill, 23 comandos (`critique`, `audit`, `polish`, `distill`, `animate`, `bolder`, `quieter`), e um CLI que roda **sem** IA: `npx impeccable detect index.html`. O detector pega padrões como bordas laterais coloridas, gradiente roxo, easing com "quique" e brilho escuro. |
| **taste-skill** (`Leonxlnx/taste-skill`) | `npx skills add Leonxlnx/taste-skill` [CONFERIR o caminho] | [VERIFICADO] Descrita como skill anti-slop para páginas novas, auditorias e redesenhos. |
| **design-taste** (`h3nryprod01/design-taste`) | `npx skills add h3nryprod01/design-taste` | [VERIFICADO] Fusão de impeccable, taste-skill e emilkowalski/skill. Tem `anti-slop.md`, `motion.md`, `interaction-states.md`. |
| **frontend-design** (Anthropic) | Já vem em muitos ambientes | Base da qual o impeccable partiu. |

### Three.js
| Skill | Instalação | Notas |
|---|---|---|
| **threejs-skills** (`CloudAI-X/threejs-skills`) | Copiar para `.claude/skills/` | [VERIFICADO] Cobre fundamentos, loaders, animação, iluminação, shaders. Auditada contra a doc do Three.js r160+. Vale `threejs-loaders`, `threejs-animation`, `threejs-lighting`. |
| **Three.js-Claude-Skill-Package** (`Impertio-Studio`) | Submodule em `.claude/skills/threejs` | [VERIFICADO] 24 skills atômicas: core, syntax, impl, errors, agents. Útil a de erros. |
| **threejs-game-skills** (`majidmanzarpour`) | `npx skills add majidmanzarpour/threejs-game-skills --skill '*' -a claude-code -g -y` | [VERIFICADO] Foco em jogos e inclui skills de QA e de áudio. Só a parte de depuração e verificação interessa aqui. |
| webgpu-claude-skill (`dgreenheck`) | `/skill install ...` | [VERIFICADO] Só se for mexer com WebGPU/TSL. Provavelmente desnecessário. |

**Nota:** nenhuma dessas skills cobre VRM em si. Para `@pixiv/three-vrm`, a fonte é a documentação e os exemplos oficiais do pacote. A IA deve ler os exemplos do repositório do three-vrm antes de tocar em expressões, `lookAt` e animação.

### Lacuna: skill própria
[SUGESTÃO] Depois que o projeto estabilizar, criar uma skill local `vrm-avatar-web` com: checklist da seção 2, mapeamento ARKit→VRM, receita de lip sync, armadilhas da seção 11. Dá para gerar com a skill `skill-creator`.

---

## 9. Personagens (sugestão inicial, o dono ajusta)

Cada personagem é **dados**, não código: um objeto em `characters.js`.

| id | Nome | Papel | Público | Voz Kokoro | Ritmo |
|---|---|---|---|---|---|
| luma | Luma | Professora, perguntas do dia a dia, histórias | 5 a 10 anos | `pf_dora` | 0.95 |
| matematico | Teo | Resolver problemas de matemática com método | 10+ | `pm_alex` | 0.98 |
| engenheiro | Rafa | Projetar, estimar, escolher entre alternativas | 12+ | `pm_santa` | 1.0 |
| cientista | Nina | Explicar fenômenos e propor experimentos seguros | 8+ | `pf_dora` (speed 1.05) | 1.05 |
| ingles | Sam | Praticar inglês | 8+ | `af_*` ou `bf_*` (inglês) | 0.95 |

Campos por personagem: `id, nome, arquivoVrm, creditosVrm, persona (system prompt), voz {motor, id, speed}, enquadramento {distancia, altura}, animacoes {idle, talk, think, greet}, atalhos[] (chips), paleta, publico, regrasDeSeguranca`.

### Como cada um resolve problemas (o coração do pedido)

**Teo, o matemático**
1. Reformula o problema em uma frase e diz o que é dado e o que se pede.
2. Escolhe um método e diz qual, em uma frase.
3. Resolve em passos curtos. Cada passo aparece no quadro; só o essencial é falado.
4. **Confere** o resultado (substituindo de volta ou por estimativa).
5. Diz a resposta final, com unidade.
- Contas não são confiadas ao modelo. O modelo chama uma função `calcular(expressao)` (execução local, com `mathjs`) e usa o resultado. [SUGESTÃO] Gemini suporta function calling; confirmar no momento da implementação.
- Se faltar dado, pergunta uma coisa só.

**Rafa, o engenheiro**
1. Pergunta ou assume requisitos e restrições (e diz quais assumiu).
2. Faz estimativa de ordem de grandeza antes de detalhar.
3. Compara 2 ou 3 alternativas com o custo de cada uma (prazo, dinheiro, risco).
4. Recomenda uma e diz o que a derrubaria.
5. Sempre com unidades. Em assunto com risco físico (estrutura, elétrica, gás), diz que precisa de profissional habilitado.

**Luma, a professora**: mantém as regras atuais do `RULES` do arquivo (frases curtas, sem símbolos, sem dados pessoais, desvio de assuntos adultos).

---

## 10. Anti-slop: o que é proibido aqui

### Visual
- Gradiente roxo/azul-violeta, brilho neon, sombras difusas em tudo
- Cards de vidro empilhados (glassmorphism) sem função
- Borda colorida só na lateral do card
- Emoji como ícone (usar SVG de um conjunto único e coerente)
- Grade de 3 cards iguais com ícone + título + frase
- Easing com "quique" e animação que não comunica estado
- Fonte padrão de IA sem decisão por trás. Escolher tipografia com motivo e registrar o motivo
- Alvo de toque menor que 44 px

### Texto (interface e falas dos personagens)
- Abrir resposta com "Claro!", "Ótima pergunta!", "Com certeza!"
- Frases de enchimento e repetição do que o usuário acabou de dizer
- Travessão em excesso, listas de três adjetivos, "no mundo de hoje"
- Emoji, asteriscos e markdown em texto que será falado
- Personagem dizendo que é "uma IA" sem ser perguntado. Cada um tem voz própria e específica

### Código
- Comentário que só repete o código
- `try/catch` que engole erro em silêncio
- Dependência sem versão exata
- Afirmar "funciona" sem ter executado

### Direção visual por personagem [SUGESTÃO]
Cada personagem com paleta, luz e cenário próprios, definidos no objeto de dados, sem componentes novos.
- Luma: luz de dia, fundo claro e quente, tipografia arredondada legível
- Teo: fundo neutro escuro, quadro em destaque, tipografia com boa leitura de números
- Rafa: fundo de prancheta/papel milimetrado suave, tipografia técnica sóbria

Cenário 3D só a partir de arquivos prontos CC0 (Poly Haven, Kenney, Quaternius aparecem na lista `madjin/awesome-cc0`). Não montar móveis com `BoxGeometry`.

---

## 11. Armadilhas conhecidas do arquivo atual

Lidas em `professora-3d.html`:

1. `makeDefaultAvatar()` (~70 linhas) monta um personagem com esferas e cápsulas. **Remover.** Sem `.vrm` carregado, mostrar tela de erro clara, não um boneco improvisado.
2. Sala de aula montada com `BoxGeometry` (parede, lousa, janela). Remover ou trocar por asset pronto.
3. Boca: `Math.sin(t*17)` e `Math.sin(t*5.3)`, sem relação com o áudio.
4. Voz: `speechSynthesis`, com seleção por regex de nome. Trocar por adaptador Kokoro.
5. Resposta do Gemini vem inteira (`generateContent`) antes de falar, então a primeira palavra demora. Usar streaming (`streamGenerateContent`) e falar por sentença.
6. Chave do Gemini em `localStorage`, enviada do navegador. Aceitável para protótipo pessoal. Se o app for publicado, colocar um proxy mínimo.
7. `@huggingface/transformers@3` sem versão exata no fallback do Whisper.
8. Braços forçados com `rotation.z = ±1.2` nos nós normalizados. Trocar por VRMA idle.
9. Sem `vrm.lookAt`: o olhar não segue nada.
10. Histórico único. Com vários personagens, guardar histórico **por personagem** e limpar ao trocar.
12. Modelo do Gemini fixo no código (`const MODEL = 'gemini-2.5-flash'`). Ver seção 23: tornar configurável, com cadeia de reserva.
11. Um arquivo só com ~680 linhas. Com 5 personagens e webcam, dividir em módulos ES sem bundler: `scene.js, avatar.js, tts/, brain.js, camera.js, characters.js, ui.js`.

---

## 12. Log de aprendizados (a IA preenche)

Formato: `AAAA-MM-DD | o que testou | resultado | decisão`

- 2026-10-01 | metadados do `8590256991748008892.vrm` | VRM 0.x, título AvatarSample_A, autor VRoid Project, licença Other com URL do VRoid Hub (uso por todos, comercial permitido, crédito desnecessário, redistribuição permitida) | movido para `assets/avatars/` com o nome original; Luma usa este modelo; Teo, Rafa e Nina continuam com os CC0 do 100Avatars (decisão do dono)
- 2026-10-01 | folha de contato (4 instantes) + medidas de quadril dos 7 VRMA do pacote e do idle do ChatVRM, em `relatorios/folhas/` | a numeração do readme bateu com o que se vê: 01 volta de 360 graus com braços abertos; 02 sai agachada e levanta acenando, termina acenando (início e fim não neutros, 124 graus de diferença); 03 sinal com dedos perto do rosto; 04 mão à cabeça com indicador, depois aponta; 05 giro de 360 graus; 06 mão na cintura, de lado; 07 agacha 23 cm. Nenhum clipe tem trilha de expressão nem de olhar | 02 desligado por padrão (grande demais para cumprimento); 04 e 07 desligados; 04 fora do modo infantil
- 2026-10-01 | `idle.vrma` (ChatVRM) no sample do VRoid | laço perfeito (primeiro e último quadro iguais), quadril desloca 1,7 cm | idle em laço NÃO é lacuna; a 25.6 estava desatualizada
- 2026-10-01 | pesquisa de aceno pronto (P2, degrau 1) | nenhum .vrma de aceno simples com licença clara e gratuita encontrado; VTubeMe VRM Poser tem preset Wave mas exporta pose parada de 1 s; biblioteca VTubeMe (12 clipes) sem aceno; coleção BOOTH 5520942 proíbe uso comercial; melhor caminho: Mixamo 'Waving' + fbx2vrma-converter (MIT, CLI Node 18+) | aguardando o dono baixar
- 2026-10-01 | conversão do `aceno.fbx` (Mixamo) com fbx2vrma-converter | converteu sem erro e o retarget ficou bom no sample (só o braço direito, quadril parado 2 mm, sem trilha de expressão). Mas o FBX tem só 0,37 s (12 quadros, medido com FBXLoader): é um único ciclo de oscilação com o braço já levantado, sem subir nem descer | perguntar ao dono: baixar de novo uma versão mais longa ou repetir o ciclo em laço com crossfade de entrada e saída
- 2026-10-01 | `aceno2.fbx` (Mixamo, versão longa) convertido e testado no sample | 4,71 s, sobe o braço direito até o rosto, acena e desce; começa e termina neutro (0,2 grau de diferença), quadril 2 cm, sem trilha de expressão nem olhar, sem atravessar cabelo nas 4 capturas | entra no catálogo como `aceno` (ativo). Aceno procedural não é necessário
- 2026-10-01 | linha de base (`node tools/medir.mjs base`, 1280x720, GPU D3D11, Kokoro local) | carga 2,7 s; 57,8 fps em repouso; primeira fala mediana 3,5 s (3 perguntas reais); heap 27,4 MB no início e 58,6 MB após 10 trocas (geometrias e texturas estáveis em 7 e 17) | o número de 10 trocas é INVÁLIDO: o `waitForFunction` do Playwright devolvia o objeto avatar como handle e o DevTools segurava cada avatar antigo (achado pelo snapshot do heap). Corrigido com `!!`; com a medição certa, 40 trocas ficam estáveis em ~32,7 MB, sem vazamento
- 2026-10-01 | máquina de estados (src/gestos.js, testes unitários e e2e p3-gestos) | gesto do LLM vai como marca [gesto:nome] dentro da sentença e começa quando aquela sentença começa a tocar; marca inválida ignorada e registrada; intervalo mínimo conta do FIM do gesto (contar do início deixava o gesto seguinte cair sempre que o aceno de 4,7 s ainda tocava) | adotado
- 2026-10-01 | aceno2 no enquadramento do app (câmera perto do rosto) | a mão passa NA FRENTE do rosto e encosta no cabelo por volta de 1,6 a 1,9 s; a folha de contato de corpo inteiro escondia isso. Distância mínima pulso-centro da cabeça: 0,25 m no sample; nos CC0 de cabeça grande (Teo, Nina) a razão pulso/altura da cabeça cai para 0,6 | aceno ativo, mas reprovado visualmente; pedir ao dono para baixar de novo no Mixamo com "Character Arm-Space" maior
- 2026-10-01 | aba "Enviar movimento" (pedido do dono, fora do prompt original) | .fbx do Mixamo convertido no navegador com o exemplo oficial `loadMixamoAnimation.js` do three-vrm v3.5.5 (MIT, copiado em src/vendor/mixamo); .vrma direto; arquivo guardado só no IndexedDB do navegador; "usar como" troca o clipe de um gesto. Testado com aceno2.fbx: converte, mede, vira o aceno e sobrevive ao recarregar | adotado. A distância pulso-rosto NÃO detecta mão na frente do rosto (aceno2 e sinal de paz dão valores parecidos nos 5 modelos), então esse aviso foi retirado: confere-se na prévia
- 2026-10-01 | "fixar no lugar" (pedido do dono) | quadril preso no X/Z do primeiro quadro do idle, altura e rotação livres (agachar e giro continuam). VRMA_02 sai de 0,335 m de deslocamento para 0,000 m. Usar `normalizedRestPose` ou a pose do arquivo quebrava o M6.2 nos VRM 0.x (o idle tira o quadril da pose de descanso e a câmera é apontada com o idle aplicado) | adotado, ligado por padrão
- 2026-10-01 | P4 sessão: toque, rosto ou operador iniciam; operador ou inatividade (90 s, configurável) encerram com aceno, frase e limpeza do histórico | gatilho até o gesto: 0 a 7 ms. Gesto até a fala: 2,1 a 2,9 s sem pré-síntese (Kokoro sintetizando); com cumprimento e despedida pré-sintetizados, 301 a 306 ms (5 medições com o quiosque ocioso). Logo após carregar a página, ainda com a pré-síntese rodando, chegou a 500 a 750 ms | pré-síntese adotada. O carregamento do personagem não acena mais sozinho; o aceno é da sessão
- 2026-10-01 | P5 fluxo de sessão (atração, cumprimento, consentimento, conversa, despedida, limpeza), teste p5-fluxo em retrato e paisagem | um próximo passo por etapa; microfone começa desligado e só aparece se a pessoa aceitar; "Prefiro escrever" esconde o microfone e deixa um botão para mudar de ideia; limpeza esquece a escolha. Textos em src/strings.pt-BR.js | adotado. ATENÇÃO: o reconhecimento de voz do Chrome/Edge (SpeechRecognition) envia o áudio ao serviço do navegador; por isso a frase diz "Nada fica gravado neste totem", não "nada sai daqui". A skill impeccable só tem o SKILL.md instalado (sem scripts nem reference/): `impeccable context`, `shape`, `onboard`, `clarify` e `adapt` não rodaram como comandos
- 2026-10-01 | galeria no painel (Tocar, Pausar, Velocidade, Ligado, Ok para criança) com Playwright em retrato e paisagem | passou; escolha persiste após recarregar | a prévia usa o enquadramento do rosto, então clipes de corpo inteiro aparecem cortados (ver problemas conhecidos)

---

## 13. Referências visuais (direção, não cópia)

Referência enviada pelo dono do projeto: a personagem **Sam** (Samsung). Outras citadas: **Lu** (Magalu), **Galaxy/AR Emoji** (Samsung) e avatares da **Meta**.

**Atualização (4ª rodada):** o dono do projeto passou a usar os **samples do VRoid Studio** como referência de estilo, além de baixar modelos do Open Source Avatars. A referência da Sam continua valendo só para comportamento (expressão, pose, identidade de roupa). O look semi-realista da seção 14 deixa de ser meta: manter o MToon com a aparência padrão dos samples e ajustar luz e fundo, sem forçar sombreamento realista.

**Regra de propriedade intelectual:** são referências de *direção de arte e de comportamento*. Não baixar, extrair, imitar o rosto, nem recriar esses personagens. Os `.vrm` continuam sendo os da seção 2.

O que os casos documentados ensinam:

| Fato | Fonte | O que levar para o projeto |
|---|---|---|
| A Sam passou de um visual 2D, parecido com Memoji, para um 3D com mais expressões, poses e texturas. | [VERIFICADO] Voicebot, Promoview | Variedade de expressão e de pose pesa mais que detalhe de polígono. |
| O estúdio dedicou esforço a materiais realistas, principalmente cabelo e roupa. | [VERIFICADO] Voicebot | Escolher `.vrm` com bom cabelo e tecido. Ajustar luz para valorizá-los. |
| Os traços lembram anime/mangá, e as roupas são simples mas dão identidade forte. | [VERIFICADO] Promoview | Cada personagem com uma roupa e uma silhueta reconhecíveis. Sem excesso de acessório. |
| Lu atende dúvidas e resolve problemas, além de ser o rosto da marca. | [VERIFICADO] Wikipedia (Virtual human) | Personagem que *resolve*, não só decora. Reforça o foco em Teo e Rafa. |
| AR Emoji da Samsung gera avatares 3D animados a partir da câmera. | [VERIFICADO] Wikipedia (AR Zone) | Inspiração para o modo espelho da webcam. |
| Meta Avatars | Nada verificado nesta pesquisa. | [SUGESTÃO] Só usar como referência de "estilizado e expressivo". Não afirmar detalhes técnicos. |

**Leitura da imagem de referência (Sam), em palavras, para quem não vê a imagem:**
estilo 3D semi-realista estilizado; olhos grandes e expressivos com brilho e profundidade; pele com sombreamento suave, sem contorno grosso; cabelo em mechas com volume e luz de recorte; roupa casual escura com dobras de tecido; pose natural e assimétrica (mão no queixo, cabeça inclinada), não "pose de catálogo"; luz de estúdio suave; fundo dividido em duas cores, um lado quente e outro frio.

**Limite honesto:** VRM usa o shader MToon, nascido para estética de anime. O visual semi-realista da referência pede um `.vrm` com materiais bem feitos e ajuste de luz. Dá para chegar perto, mas não ficar idêntico a um render de estúdio.

---

## 14. Render: aproximar do look semi-realista com VRM

MToon mistura cor de luz e cor de sombra conforme a iluminação.

- **Shading Toony:** [VERIFICADO] valor 0 dá sombreamento suave, perto do realista (modelo Lambert); valor 1 dá corte nítido de anime. Para o look da referência, testar entre 0.2 e 0.6 por material. [SUGESTÃO] os números exatos dependem do modelo.
- **Contorno:** [VERIFICADO] controlado por `outlineWidthMode`, `outlineColorFactor` e `outlineLightingMixFactor`. Para pele e rosto, contorno fino ou desligado, com `outlineLightingMixFactor` alto para o traço escurecer na sombra. Em modo `screenCoordinates` a espessura fica constante com o zoom. [CONFERIR] a escala de valores num modelo real; fontes de terceiros indicam que perto de 0.005 dá 1 a 2 pixels.
- **Luz:** rig de três pontos: principal suave, preenchimento frio e luz de recorte quente no cabelo. A cor da luz de recorte combina com o lado quente do fundo.
- **Fundo:** dividido em duas cores (quente e frio) por personagem, em CSS ou em um plano simples. Nada de móveis procedurais.
- **Sombra de contato** suave sob o personagem. Sem sombra dura.
- **Bloom** só se houver emissivo no modelo ou na roupa. [VERIFICADO] o MToon tem emissão que o bloom aproveita. Intensidade baixa.
- **Anti-serrilhado:** `antialias` já existe; avaliar SMAA se o cabelo cintilar.
- **WebGPU:** [VERIFICADO] o three-vrm tem `MToonNodeMaterialLoaderPlugin` para WebGPU. Não adotar agora; só se o desempenho exigir.
- **Qualidade adaptativa:** medir FPS; se cair, reduzir pixel ratio, desligar sombra, depois bloom. Mostrar no painel de depuração.
- Se o rosto do `.vrm` ficar "chapado", a causa costuma ser o modelo, não o código. Registrar e trocar o arquivo.

---

## 15. Expressividade (o que separa boneco de personagem)

1. **Camada de emoção.** O modelo de linguagem marca cada sentença com uma emoção (`neutro`, `alegre`, `pensativo`, `surpreso`, `curioso`, `empático`). A marca é removida antes do TTS e mapeada para expressões VRM (`happy`, `sad`, `surprised`, `relaxed`) com intensidade baixa (0.2 a 0.5) e transição suave. Sem marca válida, volta ao neutro.
2. **Microexpressões:** intervalo de piscada variável, piscada dupla ocasional, sacadas oculares pequenas, respiração.
3. **Pose de assinatura por personagem** via VRMA, no estilo da referência (pose assimétrica e natural): Teo com a mão no queixo ao pensar; Rafa com os braços cruzados ao estimar; Luma com um aceno.
4. **Escuta ativa:** enquanto o usuário fala (VAD detecta), o personagem inclina a cabeça e dá acenos curtos. É o que mais humaniza e custa pouco.
5. **Transições:** nunca trocar de pose por corte seco. Crossfade de 200 a 400 ms.
6. **Limite:** expressão exagerada cansa. Regra de bolso: no máximo uma emoção forte a cada quatro sentenças.

---

## 16. RAG simples (base de conhecimento por personagem)

**Objetivo:** cada personagem responde com base em documentos curados, cita de onde veio, e diz "não sei" quando a base não cobre. Tudo local.

### Pipeline
1. **Ingestão:** arquivos `.md` e `.txt` em `knowledge/<personagem>/`. PDF só se necessário. Cada arquivo com cabeçalho `fonte:` e `licenca:`.
2. **Chunking:** por seção (título), cerca de 150 a 300 palavras, sobreposição curta. Preservar o título do documento em cada pedaço.
3. **Embeddings locais** com `@huggingface/transformers`, modelo **multilíngue**.
   - [VERIFICADO] E5 usa os prefixos `query: ` (consulta) e `passage: ` (documento), com pooling por média e normalização L2.
   - [VERIFICADO] `multilingual-e5-small`: 384 dimensões, até 512 tokens. Há exportações ONNX em `Xenova/` e `onnx-community/`. [CONFERIR] o id exato e a variante quantizada antes de usar.
   - `all-MiniLM-L6-v2` aparece em quase todos os exemplos de RAG no navegador, mas é principalmente de inglês. [CONFERIR] Para português, preferir o E5.
   - [VERIFICADO] EmbeddingGemma roda no navegador com WebGPU e tem qualidade maior, mas pesa cerca de 300 MB. Só se o dono quiser trocar tamanho por qualidade.
   - Alternativa em nuvem: `gemini-embedding-001` com `taskType` `RETRIEVAL_DOCUMENT` e `RETRIEVAL_QUERY`. [VERIFICADO] Só a saída de 3072 dimensões já vem normalizada; em dimensão menor, normalizar na mão. Definir a dimensão **antes** de indexar. Gera custo e envia texto para a API; local é o padrão.
4. **Armazenamento:** vetores em `Float32Array` + metadados em IndexedDB. [VERIFICADO] Para até alguns milhares de pedaços, busca por força bruta (cosseno) é mais rápida que índice; acima disso, pensar em ANN.
   - Descartado por exagero: PGlite + pgvector, LanceDB. [VERIFICADO] existem em exemplos.
   - Existe a biblioteca `tRAGar` (OPFS ou IndexedDB, chunker que trata acentos do espanhol) e `client-vector-search`. Avaliar, mas ~150 linhas próprias resolvem e evitam dependência.
5. **Busca híbrida:** cosseno + palavra-chave simples, fundidos por Reciprocal Rank Fusion. [VERIFICADO] técnica usada em projetos de RAG no navegador.
6. **Limiar de confiança:** abaixo dele, o personagem diz que não sabe e **não inventa**. Calibrar o limiar com perguntas de teste dentro e fora da base.
7. **Prompt:** trechos recuperados entram como bloco `<fonte id=...>`, marcados como dado, nunca como instrução. Resposta cita o id; o quadro mostra as fontes.

### Invalidação do índice
Chave = `hash(conteúdo) + id do modelo + versão do chunker + prefixo`. [VERIFICADO] Mudou modelo, dimensão ou pré-processamento → reindexar tudo. Mudou um arquivo → reindexar só ele.

### Conteúdo semente
**Substituído.** O tema do corpus agora é a UEMA, definido na seção 20, com ingestão pela seção 21. A sugestão anterior (caderno de métodos, guia de estimativas, curiosidades de domínio público) fica como opção para Teo e Rafa se o dono quiser.
A regra continua: a IA não inventa fatos para encher a base. Sem fonte, não escreve o documento.

### Riscos
- **Injeção por documento:** texto recuperado pode conter "ignore as instruções". Tratar como dado, nunca executar.
- **Criança:** a base da Luma é curada à mão, sem upload livre.

---

## 17. Cache e controle de armazenamento

### Camadas

| Camada | O que guarda | Onde | Estratégia | Invalidação |
|---|---|---|---|---|
| Shell | `index.html`, JS, CSS | Cache API (service worker) | Rede primeiro para HTML; stale-while-revalidate para JS/CSS | Versão do app |
| Binários pesados | `.vrm`, `.vrma`, WASM, modelos ONNX (Whisper, embeddings, VAD, MediaPipe, Kokoro-browser) | Cache API, cache separado | **Cache primeiro**, URL com versão | Mudou a URL ou a versão |
| Índice RAG | Vetores e metadados | IndexedDB | Local | Hash do corpus + modelo |
| Áudio TTS | Frases repetidas (saudações, atalhos) | IndexedDB (blob) | Chave = hash(motor + voz + velocidade + texto normalizado) | Limite de tamanho, LRU |
| Respostas do LLM | Só perguntas fixas (atalhos, FAQ) | IndexedDB | Chave = persona + versão + pergunta + hash do corpus. TTL | Mudou persona ou corpus |
| Preferências | Personagem, motor de voz, câmera | `localStorage` | Local | — |

[VERIFICADO] padrões usados na prática: cache primeiro para binários versionados; stale-while-revalidate para scripts e estilos; rede primeiro para casca HTML e dados que exigem frescor; casca pré-cacheada na instalação, mas **nunca** payload grande e dinâmico no precache; caches separados por tipo (`app-shell-v2`, `images-v1`).

### Regras
1. **Nunca cachear** chamadas com chave de API (Gemini). Nem respostas do Kokoro-FastAPI com estado.
2. **Versionar os nomes dos caches** e apagar os antigos no evento `activate`. [VERIFICADO] versionamento errado de cache é a causa mais comum de quebra com service worker.
3. **Atualização controlada:** novo service worker espera; a interface mostra "nova versão disponível" e o usuário aceita. Nada de `skipWaiting` automático no meio de uma conversa.
4. **Armazenamento persistente:** chamar `navigator.storage.persist()` após uma ação do usuário; [VERIFICADO] sem isso o navegador pode apagar caches quando o espaço aperta.
5. **Cota:** `navigator.storage.estimate()` para mostrar uso e limite. [VERIFICADO] estourar a cota gera `QuotaExceededError`; tratar com limpeza LRU e aviso, nunca silenciar.
6. **Respostas opacas** (CDN sem CORS) são infladas na contagem de cota e arriscadas. [VERIFICADO] Preferir **hospedar localmente** os arquivos críticos (WASM, worklet, modelos) em vez de depender de CDN.
7. Service worker exige contexto seguro; `localhost` serve.
8. Testar offline de verdade: [VERIFICADO] a caixa "Offline" do DevTools não substitui teste real.

### Painel "Armazenamento" nas configurações
- Lista por categoria (modelos, personagens, índice, áudio, respostas) com tamanho e estado.
- Botões: baixar, apagar uma categoria, apagar tudo.
- Barra de progresso nos downloads de modelo, com tamanho antecipado.
- Indicador "pronto para uso offline" por personagem.

---

## 18. Voz mãos-livres (VAD)

Hoje o usuário aperta o microfone. Para totem, é melhor falar e ser ouvido.

- **Ferramenta:** `@ricky0123/vad-web` (Silero VAD). [VERIFICADO] `MicVAD.new({ onSpeechStart, onSpeechEnd })`; `onSpeechEnd` entrega `Float32Array` a 16 kHz, que é exatamente o formato que o Whisper do pipeline atual consome. Roda `onnxruntime-web`.
- **Hospedagem dos arquivos:** [VERIFICADO] é preciso servir o `.onnx`, o worklet e os `.wasm`, apontando por `baseAssetPath` e `onnxWASMBasePath`. Hospedar localmente e pinar a versão exata (`npm view`).
- **Interrupção (barge-in):** se o usuário começa a falar enquanto o personagem fala, cancelar TTS e fila na hora, e passar para "ouvindo".
- **Eco:** alto-falante realimenta o microfone. Ativar `echoCancellation`, e manter o modo "apertar para falar" como alternativa. Avisar que fone de ouvido resolve.
- **Latência:** medir e exibir no painel: fim da fala → texto → primeiro token → primeiro áudio. Meta [SUGESTÃO]: primeira fala em menos de 2 s quando o servidor de voz é local.

---

## 19. Quiosque, segurança e avaliação

### Modo totem
Tela cheia; após N minutos sem rosto nem toque, apagar histórico da conversa e voltar a um modo de atração (aceno discreto); ao detectar rosto, cumprimentar. Botão oculto para sair (gesto longo).

### Segurança e privacidade
- Chave do Gemini no navegador só para uso pessoal. Para publicar, **proxy mínimo** que guarda a chave e limita taxa.
- Política de segurança de conteúdo (CSP) restrita aos hosts usados.
- Nenhum HTML vindo do modelo ou da base entra no DOM sem sanitizar. Usar `textContent`.
- Crianças: [SUGESTÃO] se for publicar, consultar um profissional sobre a LGPD (dados de menores, câmera e voz). Eu não sou advogado.

### Avaliação (sem isso, "refinar" é palpite)
- **Persona:** 20 perguntas por personagem, com rubrica (voz, método, concisão, segurança). Rodar a cada mudança de prompt.
- **Anti-slop de texto:** detector de frases proibidas (seção 10) rodando sobre as respostas de teste.
- **RAG:** 15 perguntas por corpus: 10 respondíveis, 5 fora da base. Medir acerto da fonte e taxa de "não sei" correto.
- **Visual:** capturas de tela por personagem em tamanho retrato e paisagem, comparadas com a versão anterior (Playwright). Um humano aprova mudanças.
- **Desempenho:** FPS, memória após 10 trocas de personagem, tempo de carga com e sem cache.

## 20. Tema do RAG: a UEMA

**Decisão do dono do projeto:** o corpus é sobre a Universidade Estadual do Maranhão (história, estrutura, cursos, curiosidades), em versão para crianças e em versão geral. O dono fornece documentos (PDF, slides, texto). Eles entram em Markdown pela seção 21.

### Fatos verificados para a semente

Conferir cada item no site oficial antes de publicar. Fontes oficiais preferidas: `www3.secti.ma.gov.br/uema` e `dados.uema.br`. A Wikipédia serve de pista, não de fonte final.

| Fato | Selo | Fonte |
|---|---|---|
| A FESM (Federação das Escolas Superiores do Maranhão) foi criada pela Lei 3.260, de 22/08/1972, para coordenar e integrar escolas superiores isoladas. | [VERIFICADO] | SECTI-MA; Wikipédia |
| Unidades iniciais da FESM: Escola de Administração, Escola de Engenharia, Escola de Agronomia e Faculdade de Caxias. | [VERIFICADO] | SECTI-MA; Wikipédia |
| 1975: a FESM incorporou a Escola de Medicina Veterinária. 1979: Faculdade de Educação de Imperatriz. | [VERIFICADO] | Wikipédia; UniSustentável |
| A FESM virou UEMA pela Lei 4.400, de 30/12/1981. | [VERIFICADO] | SECTI-MA |
| Funcionamento autorizado pelo Decreto Federal 94.143, de 25/03/1987, como autarquia de regime especial, multicampi. | [VERIFICADO] | SECTI-MA |
| Campi iniciais: São Luís, Caxias e Imperatriz. | [VERIFICADO] | dados.uema.br |
| Estatuto aprovado pelo Decreto 15.581, de 30/05/1997. | [VERIFICADO] | Educaedu; dados.uema.br |
| Em 2016 parte da UEMA foi desmembrada para criar a UEMASUL. | [VERIFICADO] | Wikipédia |
| Hoje: 20 campi, 68 polos de EAD, presença em 88 municípios. | [VERIFICADO] com a ressalva de que a página muda; anotar a data da consulta | dados.uema.br |
| Lema: *Scientia ad Vitam*. | [VERIFICADO] só na Wikipédia. [CONFERIR] no site oficial | Wikipédia |

**Divergências a resolver, não a esconder:** número de alunos (uma fonte diz "mais de 20 mil", mas a página oficial de dados é mais atual) e quantidade de campi no início (as fontes não concordam sobre contagens). Regra: sem número datado e com fonte oficial, não afirmar número.

### Regras do corpus
1. Nenhum fato entra sem fonte e data de consulta.
2. Horários, datas de vestibular, contatos, endereços e valores só vêm de documento oficial atual fornecido pelo dono. Sem isso, o personagem diz que não sabe e indica os canais oficiais da UEMA.
3. Três níveis de linguagem por documento: `infantil`, `geral`, `tecnico`. A versão infantil é **derivada** da fonte, nunca independente dela, e só entra depois de aprovação humana.
4. Cada pedaço carrega: `fonte`, `url` ou nome do arquivo, `pagina` ou `slide`, `data_consulta`, `nivel`.

### Personagens ligados ao tema [SUGESTÃO]
| Personagem | Ligação com a UEMA |
|---|---|
| Luma | Guia infantil: o que é uma universidade, de onde a UEMA veio, onde fica. |
| Rafa | Engenharia: a Escola de Engenharia estava entre as quatro unidades originais. |
| Nina | Ciências da vida e do campo: Agronomia (original) e Veterinária (1975). |
| Teo | Matemática no dia a dia da universidade. Só afirmar sobre cursos reais com documento do curso. |

### Atividades simples sobre a UEMA
Todas usam o RAG, citam a fonte e funcionam em modo infantil.
1. **Linha do tempo:** 1972, 1975, 1979, 1981, 1987, 2016 e hoje, com o personagem narrando cada marco.
2. **Quiz da UEMA:** perguntas geradas **da base**, com resposta e fonte. Nada fora do corpus.
3. **Curso mistério:** o personagem dá três pistas sobre um curso (a partir de um documento do curso) e a criança tenta adivinhar.
4. **Pergunte sobre a UEMA:** conversa livre limitada ao corpus, com recusa gentil fora do assunto.

---

## 21. Ingestão de documentos: LlamaParse e alternativas

**Princípio:** a conversão para Markdown é um passo **offline**, feito pelo dono, antes do evento. Nunca roda no navegador do público e nunca expõe chave.

### LlamaParse
- [VERIFICADO] Cobra por página, em créditos, por camada: Fast 1, Cost-effective 3, Agentic 10, Agentic Plus 45. Extração de layout soma 3 por página. Planilha: 1 por aba.
- [VERIFICADO] A documentação recomenda começar pela camada Cost-effective para testes.
- Plano gratuito: [CONFERIR]. Fontes secundárias falam em 10.000 créditos por mês, mas uma delas diz que a página pública de preços não anunciava plano gratuito em maio de 2026, e outras citam valores diferentes (100 ou 1.000 páginas). Confirmar em `cloud.llamaindex.ai` antes de contar com isso.
- Conta de cabeça com 3 créditos por página: 100 páginas custam 300 créditos; na camada Agentic, 1.000.
- **Privacidade:** o arquivo vai para a nuvem do serviço. Enviar só documento público ou que o dono tenha autorização de enviar.
- A chave fica em variável de ambiente, no script local. **Nunca** no navegador, nunca no repositório.

### Alternativas locais (sem enviar nada)
| Ferramenta | Licença | Quando usar | Selo |
|---|---|---|---|
| MarkItDown (Microsoft) | MIT | PPTX, DOCX, XLSX e PDFs digitais simples. Frágil em PDF escaneado. | [VERIFICADO] |
| Docling (IBM) | MIT | PDFs com tabela, layout e OCR. Mais pesado de instalar. | [VERIFICADO] |
| PyMuPDF4LLM | **AGPL-3.0** | PDF digital rápido. A licença AGPL exige cuidado se o código for distribuído. | [VERIFICADO] |

**Estratégia em camadas** [VERIFICADO como recomendação de terceiros]: MarkItDown primeiro; se a estrutura sair quebrada (sem tabelas, quase sem títulos), Docling; LlamaParse só para o que sobrar.

### Depois da conversão
1. Revisão humana de cada arquivo (conversão erra tabela, ordem de leitura e nota de rodapé).
2. Cabeçalho `fonte`, `url`, `data_consulta`, `nivel`, `licenca`.
3. Slides: um slide, um pedaço; notas do orador incluídas e marcadas como tal.
4. Versão infantil: gerada por LLM a partir do texto aprovado, com rótulo `derivado_de:` e **aprovação humana** antes de entrar.
5. Pasta de caixa de entrada (`knowledge/_inbox/`) separada da base aprovada. O RAG só lê a base aprovada.

---

## 22. Vozes: Kokoro × ElevenLabs × NaturalReader

| | Kokoro | ElevenLabs | NaturalReader |
|---|---|---|---|
| Onde roda | Local (servidor próprio) | Nuvem | Nuvem |
| Custo variável | R$ 0 | Por caractere | Por crédito (por caractere, depende da voz) |
| Português do Brasil | 3 vozes (`pf_dora`, `pm_alex`, `pm_santa`) | [CONFERIR] suporte nos modelos Flash/Multilingual e quais vozes soam brasileiras | [CONFERIR] varia por voz |
| API para o app | Sim (Kokoro-FastAPI) | Sim | **Não confirmada** |
| Licença de uso | Pesos com licença Apache [VERIFICADO] | Plano gratuito sem licença comercial [VERIFICADO]. Pago libera. | Planos comerciais incluem licença [VERIFICADO] |

### ElevenLabs
- [VERIFICADO em 23/09/2026, fonte secundária] API: US$ 0,10 por 1.000 caracteres nos modelos Multilingual v2 e v3; US$ 0,05 nos modelos Flash e Turbo.
- [VERIFICADO] Planos: Gratuito US$ 0 (10 mil créditos), Starter US$ 6 (30 mil créditos), Creator US$ 22 (121 mil créditos). A mesma fonte dá cotas de caracteres por modelo: Starter 120 mil caracteres Flash/Turbo ou 60 mil Multilingual; Creator 220 mil caracteres.
- Fontes divergem em centavos (Starter em US$ 5 ou 6, API Flash em US$ 0,05 ou 0,06). [CONFERIR] em `elevenlabs.io/pricing` no dia da compra.
- [VERIFICADO] O plano gratuito exige atribuição e não dá direito de uso comercial. Para um evento institucional, perguntar à ElevenLabs ou usar plano pago.
- Teste de qualidade cabe no plano gratuito (poucos milhares de caracteres).

### NaturalReader
- [VERIFICADO] Planos comerciais: Starter US$ 16,50 por mês com 500 mil créditos; Creator US$ 24,75 com 2 milhões.
- [VERIFICADO] Consumo de crédito por caractere depende da voz: 1 crédito nas vozes Gemini, OpenAI, Azure e Google Chirp HD; 10 (Turbo) ou 20 (HD) nas vozes ElevenLabs acessadas **por dentro** do NaturalReader. Ou seja, comprar voz ElevenLabs via NaturalReader sai bem mais caro que direto na ElevenLabs.
- [VERIFICADO] Baixar áudio exige plano pago. Sem assinatura, dá para ouvir amostras de até 10 mil caracteres por dia.
- **API REST:** um diretório de terceiros diz que existe, mas não achei documentação pública. [NÃO CONFIRMADO] Até o suporte confirmar, tratar como **estúdio de pré-gravação**: gerar MP3 de falas fixas e importar no app.

### Papel de cada um (decisão provisória, a ser validada pelo teste cego)
- **Kokoro:** voz ao vivo, todas as respostas livres. Custo zero por resposta.
- **ElevenLabs:** pré-gravação das falas mais importantes (abertura, história da UEMA, respostas do quiz) e, se sobrar orçamento, uma "voz premium" com teto de caracteres.
- **NaturalReader:** só se a pré-gravação em lote com vozes de 1 crédito por caractere compensar. Comparar com ElevenLabs no teste.

### Laboratório de vozes (teste cego)
- 12 a 15 frases fixas: palavras difíceis (Maranhão, UEMA, UEMASUL, FESM, Imperatriz, Caxias, *Scientia ad Vitam*), datas por extenso, números, uma frase longa, uma pergunta, uma exclamação.
- Cada frase em cada voz, em ordem aleatória, sem rótulo. 5 avaliadores dão nota de 1 a 5 em naturalidade, clareza e pronúncia dos nomes.
- Medir também: tempo até o primeiro áudio, estabilidade (mesma frase, duas gerações) e custo por 1.000 caracteres.
- **Léxico de pronúncia:** tabela por motor para respelling (ex.: como escrever "UEMA" para soar certo). Kokoro aceita ajuste de fonemas em alguns frontends. [CONFERIR] a sintaxe no kokoro-js e no Kokoro-FastAPI antes de depender disso.

---

## 23. Orçamento: teto de R$ 200

**Câmbio de referência:** US$ 1 ≈ R$ 5,17 em 30/09/2026 [VERIFICADO]. Então R$ 200 ≈ US$ 38,7. Reservar 15% para câmbio, IOF e taxa do cartão. [CONFERIR] o IOF e a taxa efetivos do seu cartão.

### Custos unitários
| Item | Preço | Selo |
|---|---|---|
| Kokoro (servidor próprio) | R$ 0 por resposta | [VERIFICADO] |
| ElevenLabs Starter | US$ 6/mês ≈ R$ 31 | [VERIFICADO] |
| ElevenLabs Creator | US$ 22/mês ≈ R$ 114 | [VERIFICADO] |
| NaturalReader Starter | US$ 16,50/mês ≈ R$ 85 | [VERIFICADO] |
| Gemini 2.5 Flash-Lite | US$ 0,10 entrada / 0,40 saída por 1 M tokens | [VERIFICADO] fonte secundária |
| Gemini 2.5 Flash | US$ 0,30 / 2,50 | [VERIFICADO] fonte secundária |
| Gemini 3.1 Flash-Lite | US$ 0,25 / 1,50 | [VERIFICADO] fonte secundária |

### Contas
Premissa: resposta com 2.000 tokens de entrada (persona, trechos do RAG, histórico) e 200 de saída; 300 caracteres falados.

| LLM | Custo por resposta | 5.000 respostas |
|---|---|---|
| 2.5 Flash-Lite | ≈ R$ 0,0014 | ≈ R$ 7 |
| 3.1 Flash-Lite | ≈ R$ 0,0041 | ≈ R$ 21 |
| 2.5 Flash | ≈ R$ 0,0057 | ≈ R$ 28 |

| Voz | 5.000 respostas de 300 caracteres (1,5 M caracteres) |
|---|---|
| Kokoro | R$ 0 |
| ElevenLabs Flash a US$ 0,05/mil | US$ 75 ≈ **R$ 388** (estoura o teto) |
| ElevenLabs Creator (220 mil caracteres) | cobre só ≈ 730 respostas |
| ElevenLabs Starter (120 mil caracteres) | cobre só ≈ 400 respostas |

**Conclusão:** o LLM é barato. A voz em nuvem, ao vivo, para todo mundo, não cabe em R$ 200. Por isso a arquitetura é **híbrida**: Kokoro ao vivo, voz premium pré-gravada.

### Planos de exemplo (R$, antes da margem)
| Plano | Composição | Total |
|---|---|---|
| A. Mínimo | Kokoro + Gemini Flash-Lite | ≈ R$ 7 a 21 |
| B. Recomendado | A + ElevenLabs Starter (pré-gravação de ≈ 50 falas, cerca de 15 mil caracteres, e voz premium com teto) | ≈ R$ 40 a 55 |
| C. Premium limitado | A + ElevenLabs Creator com teto duro por dia | ≈ R$ 130 a 145 |

Todos ficam abaixo de R$ 200 com margem. Os números dependem de câmbio e de plano; recalcular no dia.

### Gemini: três avisos
1. **Não fixar o id do modelo.** O arquivo atual usa `gemini-2.5-flash` direto no código. A página oficial de descontinuações mostrou, em consulta de 01/10/2026, "sem data de encerramento" para esse modelo, mas uma data de 16/10/2026 apareceu e sumiu em agosto, e há modelos mais novos (3.1 Flash-Lite, 3.5 Flash). Tornar o modelo configurável, com cadeia de reserva, e consultar a página de descontinuações antes do evento. [VERIFICADO]
2. **Plano gratuito não serve para o evento.** [CONFERIR] Os limites divergem entre fontes (algo como 10 requisições por minuto e 500 a 1.500 por dia nos modelos Flash), o que é pouco para fila de crianças. Além disso, [VERIFICADO em uma fonte] no plano gratuito o conteúdo pode ser usado para melhorar produtos do Google. Para crianças, usar o plano pago e ler os termos de dados.
3. **Conta com faturamento ativa** libera limites bem maiores. [VERIFICADO] Para 2.5 Flash, de 10 para 2.000 requisições por minuto.

### Proteções de gasto (obrigatórias)
- **Cartão virtual com limite** de R$ 200 (ou menos). O teto real é o do cartão, não o do código.
- Alertas e cotas no painel de cada provedor. [CONFERIR] o que cada um oferece.
- **Chaves pagas só no servidor local (proxy)**, nunca no navegador. Chave exposta no navegador deixa qualquer pessoa gastar o seu orçamento.
- Medidor de custo no app: caracteres e tokens por sessão e por dia, preço editável, aviso aos 80%, troca automática para Kokoro ao bater o teto.
- Botão de emergência no painel do operador: "modo econômico" (só Kokoro e respostas prontas).

---

## 24. Modo evento (demonstração controlada)

Premissa do dono: é uma **demonstração rápida**, não atendimento de massa. O público de milhares é pano de fundo; o que se controla é a estação.

- **Política de sessão:** limite de turnos (ex.: 3 a 5), tempo máximo, limpar histórico ao terminar ou após inatividade, fila visível.
- **Dois modos no painel do operador** (que **estende** o painel de configurações que já existe: tokens, prompt etc.):
  1. *Demonstração guiada:* botões e atalhos, respostas e áudios pré-gravados. Funciona sem internet.
  2. *Conversa livre:* LLM + RAG + voz, limitada ao corpus da UEMA, com recusa gentil fora do assunto.
- **Escada de falhas** (cada degrau avisa o operador e continua):
  1. Voz premium cai ou estoura o teto → Kokoro.
  2. Gemini falha, estoura cota ou fica lento → resposta pronta do RAG (trecho citado) + Kokoro.
  3. Internet cai → modo guiado com áudios pré-gravados.
  4. Kokoro cai → voz do navegador, com aviso.
- **Pacote de áudio pré-gravado:** arquivos gerados antes do evento, indexados por hash do texto e voz. É o que a camada de cache de áudio (seção 17) já faz; aqui ele é preenchido antecipadamente.
- **Privacidade com crianças:** não perguntar nome nem escola; não gravar áudio nem imagem; registros só com contadores; avisar a organização sobre microfone e câmera. [SUGESTÃO] Consultar a UEMA sobre a política de imagem e voz de menores. Eu não sou advogado.
- **Ensaio:** roteiro de teste de 30 minutos no local, com a rede do evento, antes de abrir ao público.

## 25. Animação de aceno e gestos

Objetivo: o personagem acena ao cumprimentar e ao se despedir, e tem um conjunto pequeno de gestos que reforçam a conversa. **Os clipes vêm de arquivos prontos.** Nenhuma pose é inventada por código (regra da seção 3).

### 25.1 Onde conseguir os clipes

| Fonte | Licença e restrições | Selo |
|---|---|---|
| **Pacote VRMA do VRoid Project** (BOOTH, gratuito): 7 clipes: Show full body, Greeting, Peace sign, Shoot, Spin, Model pose, Squat | Uso comercial permitido, com frase de crédito. A frase exata está no `Readme_VRMA_MotionPack_EN.txt` dentro do zip. **Não pode ser redistribuído**: cada pessoa baixa o seu. Por isso não commitar os `.vrma` em repositório público. | [VERIFICADO] |
| **Mixamo** (FBX), com retarget em tempo de execução pela biblioteca `vrm-mixamo-retarget` (MIT) | Termos da Adobe. Um repositório de terceiros afirma que os termos não permitem redistribuir os personagens; para animações, [CONFERIR] nos termos atuais. Padrão seguro: não commitar FBX do Mixamo em repositório público. | [VERIFICADO] a biblioteca existe (versão 1.0.3 na consulta) |
| **Mixamo → VRMA** pelo conversor `fbx2vrma-converter` (MIT, v2.1) | Compatível com `@pixiv/three-vrm-animation` 3.4.1 ou mais novo e Three.js r177 ou mais novo. Filtra canais que o formato VRMA não aceita. | [VERIFICADO] |
| **BOOTH, categoria "3D Motion/Animation"** | Criadores publicam `.vrma`. **Licença é por criador**, ler cada uma. | [VERIFICADO] a categoria existe |

**Aceno em particular:** o clipe "Greeting" (VRMA_02 na lista oficial da BOOTH) é o candidato óbvio, mas **ninguém aqui confirmou o que ele mostra** (pode ser aceno ou reverência). [CONFERIR] olhando o clipe rodando. Se não for um aceno, usar um clipe de aceno do Mixamo (convertido) ou de um criador da BOOTH com licença adequada.

**Armadilha de numeração:** o repositório de um demo lista `VRMA_02 = squat` e `VRMA_07 = greeting`, o contrário da lista oficial. [VERIFICADO] Conclusão: **nunca confiar no número do arquivo.** Gerar uma folha de contato (captura de cada clipe em 4 instantes) e identificar pelo que se vê.

### 25.1b Mais fontes e ferramentas para VRMA (rodada 5)

| Ferramenta ou fonte | O que faz | Observação | Selo |
|---|---|---|---|
| **vrm.dev/en/vrma** (especificação) | Define o formato: o mesmo `.vrma` serve a qualquer VRM. Lista ferramentas que importam ou exportam VRMA: VRM Add-on for Blender, `bvh2vrma`, VRM Posing Desktop, UniVRM. | Ponto de partida oficial. | [VERIFICADO] |
| **Librn Editor** | Cria e edita animação VRMA no navegador. | [CONFERIR] custo, licença do que for criado e limites. | [VERIFICADO] que existe e é citado para isso |
| **VTubeMe Tools** (`vtubeme.com/tools`) | Três coisas úteis: (1) conversor de FBX do Mixamo ou GLB com animação para `.vrma`, com prévia; (2) "VRM Poser", que pose o modelo e exporta a pose como `.vrma`; (3) biblioteca de `.vrma` prontos, com prévia no seu próprio modelo. | [CONFERIR] preço (o site fala em reembolso automático em caso de falha, o que sugere créditos), licença de cada clipe e política de dados. Não enviar modelos que você não possa enviar a terceiros. | [VERIFICADO] que existem na página de ferramentas |
| **Blender + VRM Add-on for Blender** (gratuito) | Importa o `.vrm`, permite animar chaves de osso à mão e exporta `.vrma`. | Caminho para criar um aceno **simples** de verdade, sem programar pose. Exige aprender o básico do Blender. | [VERIFICADO] que o add-on lista VRM Animation |
| **bvh2vrma** | Converte captura de movimento em BVH para `.vrma`. | Só vale se você tiver uma fonte de BVH com licença clara. | [VERIFICADO] que aparece na lista da especificação |
| **VRoid Hub** (comunidade) e **BOOTH** (categoria 3D Motion/Animation) | Criadores compartilham `.vrma`. | Licença por criador. Ler antes de usar. | [VERIFICADO] |
| **Photo Booth do VRoid Hub** | Reproduz `.vrma` num modelo seu publicado lá. | Alternativa de prévia. Exige conta. | [VERIFICADO] |

**Mixamo, passo a passo para um clipe simples** [CONFERIR os nomes exatos na biblioteca, que muda]: entrar com conta Adobe gratuita, buscar por termos como "waving", "talking", "thinking", "clapping", "shrugging", "head nod", "breathing idle", baixar em FBX sem pele, e converter para `.vrma` com `fbx2vrma-converter` ou com a ferramenta do VTubeMe. Para uso em evento local (quiosque, sem publicar na internet), o risco de licença é menor. Para publicar online, [CONFERIR] os termos atuais da Adobe sobre redistribuir animações.

### 25.1c Estado atual dos ativos do dono (informado em 01/10/2026)

- `8590256991748008892.vrm`: sample baixado do VRoid Hub. O nome é o identificador numérico do Hub. **Manter o nome original** e mapear no `characters.js`; renomear só se o dono pedir. Conferir autor e licença nos metadados do arquivo e na página do modelo no Hub, e registrar em `assets/avatars/CREDITS.md`.
- Pasta com o pacote `VRMA_MotionPack` (7 clipes do VRoid Project). O dono testou e gostou.
- Só **um** `.vrm` por enquanto. Os demais personagens (Teo, Rafa, Nina) ficam sem modelo e não aparecem no seletor até haver arquivo. Para completar o elenco: `AvatarSample_A`, `B` e `C` estão na lista do VRoid Hub (seção 2), e há os avatares CC0 do Open Source Avatars.

### 25.2 API de VRMA no three-vrm

[VERIFICADO no exemplo oficial do `three-vrm-animation`]:
1. Registrar `VRMAnimationLoaderPlugin` no `GLTFLoader`.
2. Carregar o `.vrma` e pegar o objeto `VRMAnimation` (o campo no `userData` do gltf: [CONFERIR] o nome exato no exemplo).
3. `createVRMAnimationClip(vrmAnimation, vrm)` devolve um `AnimationClip` já ajustado ao modelo.
4. Se o clipe tiver trilha de olhar, adicionar um `VRMLookAtQuaternionProxy(vrm.lookAt)` à cena.
5. A cada quadro: `mixer.update(dt)` **e depois** `vrm.update(dt)`. Nessa ordem, como no exemplo.

O objeto `VRMAnimation` tem trilhas de rotação dos ossos humanoides, translação só do quadril, trilhas de expressão e uma trilha de olhar opcional. [VERIFICADO]

O exemplo oficial usa Three.js 0.180 e `@pixiv/three-vrm` 3; o arquivo original do projeto usava three 0.169. [CONFERIR] a compatibilidade ao fixar versões.

### 25.3 Mecânica de animação (skill `threejs-animation`)

[VERIFICADO na skill instalada]:
- Um `AnimationMixer` por modelo. `mixer.clipAction(clip)` cria a ação.
- Transição suave: `action.reset().fadeIn(0.3).play()` e `outAction.crossFadeTo(inAction, 0.3, true)`.
- Gesto de uma vez só: `action.loop = THREE.LoopOnce` com `action.clampWhenFinished = true`. O mixer dispara o evento `finished`; nele, voltar ao `idle` com crossfade.
- Camada de respiração sobre qualquer pose: `action.blendMode = THREE.AdditiveAnimationBlendMode`, com o clipe convertido por `THREE.AnimationUtils.makeClipAdditive`.
- `clip.optimize()` remove chaves redundantes. Clipes podem ser compartilhados entre mixers.
- Pausar o mixer quando o personagem não está visível ou a aba está oculta.

### 25.4 Máquina de estados do personagem

Estados: `idle` (laço), `listening`, `thinking`, `talking`, gestos de uma vez (`aceno`, `despedida`, `comemora`, `aponta-quadro`, `desculpa`).

| Gatilho | O que acontece |
|---|---|
| Rosto detectado após ausência | `aceno` e fala curta de cumprimento. A fala começa ~300 ms depois do início do gesto. |
| Início de sessão pelo operador | Igual ao anterior. |
| Fim de sessão ou inatividade | `despedida` (aceno) e volta ao `idle`. |
| Usuário começa a falar | `listening` (inclinação e aceno de cabeça) |
| Aguardando resposta | `thinking` |
| Resposta correta no quiz | `comemora` |
| Remete ao quadro | `aponta-quadro`, se existir clipe |
| Erro de rede ou de voz | `desculpa` e mensagem simples |

Regras:
- **Prioridade** (maior vence): fala e lip sync > emoção > clipe. Expressões do clipe não podem brigar com a boca.
- **Variedade e descanso:** o mesmo gesto não repete duas vezes seguidas, e há intervalo mínimo entre gestos (ex.: 8 s).
- **Gesto não interrompe** uma palavra-chave da fala; espera a fronteira da sentença.
- **O LLM só pede gestos que existem** no inventário do personagem. Marca inválida é ignorada.
- **Modo calmo** (configuração + `prefers-reduced-motion`): sem gestos amplos e sem laços decorativos; só respiração e piscar.

### 25.5 Armadilhas
- Braços atravessando a roupa: cada `.vrm` tem proporções diferentes. Testar cada clipe em cada modelo.
- Quadril que "anda" durante laço: se acontecer, travar a translação do quadril do clipe.
- Cabelo e saia tremendo na troca de clipe: crossfade mais longo e `vrm.update` sempre depois do mixer.
- Dono do olhar: ou o clipe ou o código de `lookAt`, nunca os dois ao mesmo tempo.
- VRM 0.x: lembrar de `VRMUtils.rotateVRM0` antes de retargetar.

### 25.6 Catálogo de clipes por caso de uso

Proposta inicial. O dono confirma depois de ver cada clipe tocando no app (galeria do painel do operador, marco P1 do prompt).

| Caso de uso | Gesto | Fonte hoje | Prioridade |
|---|---|---|---|
| Cumprimento e despedida | **Aceno simples: levantar o braço e acenar** | Lacuna (ver 25.7) | Alta |
| Repouso | **Idle em laço**, respirando, sem T-pose | Lacuna | Alta |
| Falando | Gesto leve de mão em laço | Lacuna | Alta |
| Apresentar o personagem | "Show full body" (`VRMA_01`) | Pacote VRoid | Em uso |
| Acerto no quiz, alegria | "Peace sign" (`VRMA_03`) ou "Spin" (`VRMA_05`) | Pacote VRoid | Em uso |
| Atração, quiosque ocioso | "Model pose" (`VRMA_06`) ou "Spin" | Pacote VRoid | Em uso |
| Pensando | Mão no queixo ou olhar para cima | Lacuna | Média |
| Ouvindo | Aceno de cabeça curto | Lacuna | Média |
| "Não sei" (RAG sem resposta) | Encolher os ombros | Lacuna | Média |
| Aplaudir | Palmas | Lacuna | Baixa |
| Apontar para o quadro | Aponta com a mão | Lacuna | Baixa |
| Desculpa (erro) | Gesto de desculpa | Lacuna | Baixa |
| Agradecer | Reverência curta | Talvez "Greeting" (`VRMA_02`), se for reverência | Baixa |
| Sem uso definido | "Shoot" (`VRMA_04`) e "Squat" (`VRMA_07`) | Pacote VRoid | Desligados por padrão |

**Nota para o público infantil [SUGESTÃO]:** "Shoot" parece gesto de arma de dedo. Deixar desligado no modo infantil, mesmo que o dono goste do movimento.

A numeração `VRMA_01` a `07` vem da lista oficial da BOOTH (Show full body, Greeting, Peace sign, Shoot, Spin, Model pose, Squat) [VERIFICADO]. Fontes públicas divergem sobre ela; o dono deve confirmar o que cada arquivo mostra.

**Especificação de cada clipe novo** (para pedir, procurar ou criar): nome, duração, se é laço, pose inicial e final neutras (para o crossfade não pular), quadril sem deslocamento, sem expressão facial embutida (a boca é do lip sync), e licença registrada.

### 25.7 Aceno simples: ordem de tentativas

O dono quer algo mais simples que os clipes do pacote: **levantar o braço e acenar**. Ordem:

1. **Procurar um clipe pronto**: Mixamo "waving" (convertido), biblioteca do VTubeMe, VRoid Hub, BOOTH. Escolher o mais discreto, com o braço à altura do ombro ou do rosto, sem mexer o corpo todo.
2. **Criar o clipe com uma ferramenta de animação** (Librn Editor ou Blender com o VRM Add-on), exportar `.vrma` e carregar como qualquer outro. Continua sendo "arquivo pronto": a pose é feita por uma pessoa em editor, não por código do app.
3. **Último recurso, só com aprovação explícita do dono:** aceno procedural mínimo.
   - Usa **ossos humanoides normalizados** do VRM (`rightUpperArm`, `rightLowerArm`, `rightHand`), que independem das proporções do modelo.
   - Parâmetros em dados (não no código): ângulos, 0,4 s para subir, 3 a 4 oscilações do antebraço, 0,4 s para descer. Duração total entre 2 e 3 s.
   - Entra como camada sobre o idle, com peso que sobe e desce, e nunca durante uma palavra em curso.
   - Validar em cada `.vrm`: o braço não atravessa o cabelo nem a roupa. Se atravessar, reduzir o ângulo para aquele modelo, em dados.
   - **Marcar como `procedural` no inventário e no relatório.** É a única exceção à regra de "nenhuma pose em código" (seção 3).

---

## 26. Profissionalização

1. **Fluxo de sessão completo:** atração (idle discreto) → cumprimento com aceno → pedido de consentimento de câmera e microfone → conversa → despedida com aceno → limpeza. Cada etapa tem texto curto e claro.
2. **Identidade:** cores, tipografia e logotipo vêm de material oficial que o dono fornecer. **Não recriar nem imitar o logotipo da UEMA.** Sem material oficial, usar identidade neutra e dizer isso.
3. **Tela de créditos gerada automaticamente** de `assets/avatars/CREDITS.md` e do arquivo de créditos dos clipes: autor, licença e a frase de crédito exigida pelo pacote VRoid.
4. **Verificação de licença no carregamento:** o `.vrm` carrega metadados de autor e licença. [VERIFICADO] visualizadores de VRM exibem esses campos. Os nomes dos campos mudam entre VRM 0.x e 1.0. [CONFERIR] Ler e registrar; bloquear o uso (com mensagem ao operador) quando a licença do modelo não permitir o uso previsto.
5. **Áudio sem tropeço:** navegadores só liberam som após um gesto do usuário, então o primeiro toque destrava o áudio. Controle de volume visível. Intervalo curto e constante entre sentenças. Áudios pré-gravados com volume homogêneo (normalização, por exemplo com `ffmpeg`; [CONFERIR] o filtro e o alvo). Reduzir o volume de fundo quando o usuário fala.
6. **Quiosque que não cai:** tratar `webglcontextlost` e `webglcontextrestored` (recarregar o modelo), vigia que recarrega a página se o laço de renderização travar, teste de longa duração (várias horas, memória estável), tela de erro amigável, versão do app visível **só** no painel do operador.
7. **Acessibilidade:** legendas sempre visíveis, região `aria-live` para a resposta, tamanhos de fonte e contraste adequados, foco por teclado, alvos de toque grandes, modo calmo.
8. **Textos em um arquivo só** (`strings.pt-BR.js`): facilita revisão e futura tradução. Sem texto solto no código.
9. **Painel do operador (Operate):** diagnóstico (FPS, memória, latência, gasto, estado de cada serviço), troca de personagem, modo econômico, reinício de sessão.
10. **Verificação visual de animação:** capturas dos quadros-chave de cada gesto por personagem, comparadas com a versão anterior. Humano aprova.

---

## 27. Skills: o que usar em cada etapa

Conferido nas skills instaladas neste ambiente. O catálogo da organização não trouxe skills para esse tema; as abaixo são as públicas.

| Etapa | Skill | Uso |
|---|---|---|
| Contexto de design | `impeccable` | Rodar `impeccable context` uma vez por sessão. `init` grava `PRODUCT.md`; `document` gera `DESIGN.md` do código existente; `shape` planeja a UX antes de codar. |
| Modo de cada tela | `impeccable` | A tela do personagem é **Experience** (o artefato lidera e a interface recua). O painel do operador é **Operate** (clareza e consistência acima de expressão). |
| Movimento da interface | `impeccable` `animate` | Movimento com propósito. Anima só `transform` e `opacity`. |
| Primeiro uso e vazios | `impeccable` `onboard` e `clarify` | Telas de consentimento, estados vazios, textos de erro. |
| Robustez | `impeccable` `harden` | Erros, casos de borda, textos. |
| Telas e tamanhos | `impeccable` `adapt` | Retrato e paisagem. |
| Desempenho | `impeccable` `optimize` e `audit` | Diagnóstico técnico e acessibilidade. |
| Acabamento | `impeccable` `polish` e `delight` | Última passada e toques de personalidade, nessa ordem. |
| Direção de leitura | `design-taste-frontend` | Escrever a linha "Design Read" antes de codar. Ajustar os três botões (variância, movimento, densidade). Para produto infantil e institucional, a skill manda restrições de acessibilidade e confiança passarem na frente do gosto estético. |
| Mecânica 3D | `threejs-animation`, `threejs-loaders`, `threejs-fundamentals` | Mixer, crossfade, aditivo, progresso de carregamento, redimensionamento. |
| Skill própria | `skill-creator` | Empacotar o conhecimento do projeto em `vrm-avatar-web` (já entregue em zip). Pode ser refinada com avaliações depois. |

Pontos da skill `design-taste-frontend` que valem aqui:
- Proíbe travessão (—) em qualquer texto, ponto médio como separador padrão, pontos de status decorativos, selos de versão e faixas de local/hora. Aplicar também às falas dos personagens.
- Exige respeitar `prefers-reduced-motion` quando o movimento passa de nível 3, e animar só `transform` e `opacity`.
- Ajustes sugeridos para este caso [SUGESTÃO]: variância 3 a 4, movimento 3 a 4 (só na interface; o personagem fica fora desse botão), densidade 4 a 5.

Princípio da skill `impeccable` que vale como regra de trabalho: **verificar em passes limitados, não em laço.** Construir completo, inspecionar uma vez com uma rodada em lote (retrato e paisagem juntos), corrigir tudo de uma vez, confirmar com no máximo mais uma rodada, parar. Autoverificação sem fim custa dinheiro e piora o resultado.

## 28. Fontes

- Kokoro-FastAPI: github.com/remsky/Kokoro-FastAPI
- kokoro-js: npmjs.com/package/kokoro-js
- Vozes PT no sherpa-onnx: k2-fsa.github.io/sherpa/onnx/tts/pretrained_models/kokoro.html
- Open Source Avatars: opensourceavatars.com
- awesome-cc0: github.com/madjin/awesome-cc0
- arpahls/avatar (VRM + VRMA + lip sync): github.com/arpahls/avatar
- wLipSync: github.com/mrxz/wLipSync
- Lip sync em VRM (série): dev.to/orca_forge
- MediaPipe Face Landmarker: developers.google.com/mediapipe/solutions/vision/face_landmarker/web_js
- Kalidokit: github.com/yeemachine/kalidokit
- vtubing (pipeline de referência): github.com/DarkStar1997/vtubing
- impeccable: github.com/pbakaus/impeccable
- design-taste: github.com/h3nryprod01/design-taste
- threejs-skills: github.com/CloudAI-X/threejs-skills
- Three.js-Claude-Skill-Package: github.com/Impertio-Studio/Three.js-Claude-Skill-Package
- threejs-game-skills: github.com/majidmanzarpour/threejs-game-skills
- Encerramento do Ready Player Me: avatarsdk.com/blog/2026/01/15/switch-from-ready-player-me-to-avatar-sdk-fast-familiar-production-ready

- Sam (Samsung), redesenho 3D: voicebot.ai/2021/06/01/samsung-may-replace-bixby-with-a-3d-virtual-assistant-named-sam
- Sam, traços e roupas: promoview.com.br/assistente-virtual-da-samsung-ganha-visual-repaginado
- Lu e assistentes virtuais: en.wikipedia.org/wiki/Virtual_human
- AR Emoji / AR Zone: en.wikipedia.org/wiki/AR_Zone
- MToon (Shading Toony, outline): vrm.dev/en/univrm/shaders/shader_mtoon
- Especificação VRM, materiais: github.com/vrm-c/vrm-specification
- Documentação do MToonMaterial no three-vrm: pixiv.github.io/three-vrm/docs/classes/three-vrm.MToonMaterial.html
- RAG no navegador: github.com/anna123123123-creator/browser-rag, github.com/charly-vibes/tRAGar, github.com/Hari31416/browser-rag
- Embeddings multilíngues E5 (prefixos query/passage): huggingface.co/onnx-community/multilingual-e5-base-ONNX
- EmbeddingGemma no navegador: glaforge.dev/posts/2025/09/08/in-browser-semantic-search-with-embeddinggemma
- Embeddings da API Gemini: ai.google.dev/api/embeddings
- Cache em runtime (Workbox): web.dev/articles/runtime-caching-with-workbox
- Estratégias de cache em PWA: dev.to/137foundry/understanding-cache-storage-strategies-for-progressive-web-apps-5ai7
- Cota e persistência: developer.chrome.com/blog/estimating-available-storage-space
- VAD no navegador: github.com/ricky0123/vad (guia: docs/user-guide/browser.md)
- História da UEMA (SECTI-MA): www3.secti.ma.gov.br/uema
- Dados da UEMA (campi, polos, municípios): dados.uema.br/apresentacao-uema
- UEMA na Wikipédia (pista, não fonte final): pt.wikipedia.org/wiki/UEMA
- LlamaParse, preços por página: developers.llamaindex.ai/llamaparse/general/pricing
- LlamaParse v2 (camadas): llamaindex.ai/blog/introducing-llamaparse-v2-simpler-better-cheaper
- MarkItDown × Docling × Marker: dev.to/dmaxdev/markitdown-vs-docling-vs-marker-pdf-to-markdown-for-llms-571o
- Docling × MarkItDown: file2markdown.ai/blog/docling-vs-markitdown
- Preço da API ElevenLabs (consulta de 23/09/2026): modelslab.com/elevenlabs-api-pricing
- Planos ElevenLabs: cekura.ai/blogs/elevenlabs-pricing; benchlm.ai/elevenlabs/pricing
- Planos do NaturalReader: naturalreaders.com/payment/commpay
- Créditos por voz no NaturalReader: help.naturalreaders.com/en/articles/8977584-voices-languages-and-tts-limits-commercial-version
- Preços Gemini: cloudzero.com/blog/gemini-pricing; morphllm.com/gemini-api-pricing
- Limites e faixas de uso Gemini: ai.google.dev/gemini-api/docs/rate-limits
- Descontinuações Gemini: ai.google.dev/gemini-api/docs/deprecations
- Dólar em 30/09/2026: renovainvest.com.br/dolar-hoje
- Pacote VRMA do VRoid Project (BOOTH): vroid.booth.pm/items/5512385
- Anúncio do VRMA e do Photo Booth: vroid.com/en/news/6HozzBIV0KkcKf9dc1fZGW
- Restrição de redistribuição dos VRMA: github.com/webdeveloperhyper/ai-avatar
- Retarget de Mixamo para VRM: github.com/saori-eth/vrm-mixamo-retargeter
- Conversor FBX para VRMA: github.com/tk256ailab/fbx2vrma-converter
- Exemplo oficial do three-vrm-animation: github.com/pixiv/three-vrm/blob/dev/packages/three-vrm-animation/examples/loader-plugin.html
- API do three-vrm-animation: pixiv.github.io/three-vrm/docs/modules/three-vrm-animation.html
- Discussão sobre Mixamo e VRM: github.com/pixiv/three-vrm/discussions/1088
- Visualizador de VRM com metadados e licença: vtubeme.com/tools/vrm-viewer
- Especificação VRM Animation e ferramentas: vrm.dev/en/vrma
- Onde achar e criar VRMA (Librn Editor, Mixamo, conversor): dohaicuong.github.io/three-vrm-utils/docs/links/getting-vrm-animations
- Ferramentas VTubeMe (conversor FBX para VRMA, VRM Poser, biblioteca de VRMA): vtubeme.com/tools
- Conversor FBX para VRMA online: vtubeme.com/tools/fbx-to-vrm
- VRM Add-on for Blender: vrm-addon-for-blender.info
- Condições de uso dos VRoidPreset A a Z: vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z
- Lista oficial do pacote VRMA (BOOTH): vroid.booth.pm/items/5512385