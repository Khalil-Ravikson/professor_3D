# MEGA PROMPT: reformular a Professora 3D (multi-personagem, Kokoro, webcam)

> **Pasta de referência:** tudo fica em `repertorio/`.
> - `repertorio/REPERTORIO.md` é a fonte de verdade do projeto.
> - `repertorio/REFERENCIAS-UI-INDEX.md` registra as referências de interface.
> - `repertorio/ui/` guarda as capturas de referência (imagens `.webp`).
> Onde este texto citar `REPERTORIO.md`, leia `repertorio/REPERTORIO.md`.

Cole tudo abaixo da linha em uma ferramenta com acesso a arquivos e terminal (Claude Code, Codex, Cursor).
Os arquivos de referência ficam na pasta `repertorio/` (`repertorio/REPERTORIO.md`).
Coloque na mesma pasta: `professora-3d.html`, `repertorio/REPERTORIO.md` e os arquivos `.vrm` em `assets/avatars/`.

---

## PAPEL

Você é um engenheiro front-end sênior com bom olho de design. Vai reformular um app web existente: uma professora 3D falante que roda no navegador. O arquivo atual é `professora-3d.html` (Three.js + `@pixiv/three-vrm` + Gemini + Web Speech). Leia-o inteiro antes de qualquer coisa.

Responda e comente em português do Brasil.

## PASSO 0: LEIA E VERIFIQUE ANTES DE ESCREVER CÓDIGO

1. Leia `repertorio/REPERTORIO.md` por completo. Ele é a fonte de verdade do projeto: decisões, fontes, armadilhas e o que é proibido. Se algo que você descobrir contradizer o arquivo, corrija o arquivo e registre na seção 12.
2. Leia `professora-3d.html` e confirme os problemas listados na seção 11 do REPERTORIO. Acrescente os que eu não vi.
3. Veja quais skills estão instaladas. Use as que existirem e diga quais usou:
   - design: `impeccable`, `design-taste-frontend`, `frontend-design`, `redesign-existing-projects`
   - three.js: `threejs-fundamentals`, `threejs-loaders`, `threejs-animation`, `threejs-lighting`
   Se nenhuma existir, siga as regras do REPERTORIO mesmo assim e me diga quais eu deveria instalar (comandos na seção 8 do REPERTORIO).
4. Antes de depender de qualquer pacote, rode `npm view <pacote> version` e confirme que existe e qual a API atual. Fixe versão exata. Para `@pixiv/three-vrm` e `@pixiv/three-vrm-animation`, leia os exemplos oficiais do repositório antes de mexer em expressões, `lookAt` e animação.
5. Liste os `.vrm` presentes em `assets/avatars/` e rode o checklist da seção 2 do REPERTORIO em cada um. Mostre o resultado numa tabela curta.

## REGRAS INEGOCIÁVEIS

**R1. Só `.vrm` pronto.** Nunca crie, modele, aproxime ou "monte com formas" um personagem em código. Apague `makeDefaultAvatar()`. Se o `.vrm` de um personagem não existir ou não abrir, mostre uma tela de erro clara ("coloque o arquivo em assets/avatars/nome.vrm") e nada mais. Não invente boneco reserva. Também não monte cenário com `BoxGeometry`; fundo é cor/gradiente sóbrio via CSS ou um asset CC0 pronto.

**R2. Sem cara de IA.** Aplique a lista de proibições da seção 10 do REPERTORIO (visual, texto e código). Antes de entregar, rode `npx impeccable detect .` (ou equivalente) e corrija o que aparecer. Para cada escolha de tipografia e paleta, escreva uma linha dizendo por que foi escolhida.

**R3. Não afirme o que não testou.** Cada item da entrega termina com um destes selos: `TESTADO` (executei e vi o resultado), `NÃO TESTADO` (escrevi, mas não consegui executar, e por quê). Não existe "deve funcionar".

**R4. Não invente API.** Se não tiver certeza do nome de um método ou da forma de uma resposta, consulte a documentação ou o código-fonte do pacote. Se não conseguir, diga.

**R5. Preserve o que já funciona:** layout vertical estilo totem (adaptável a paisagem), modo de digitar, atalhos, entrada por microfone com fallback Whisper local, configurações em `<dialog>`, `prefers-reduced-motion`, foco visível.

## O QUE CONSTRUIR

### 1. Seletor de personagem

- Cada personagem é um **objeto de dados** em `characters.js`, com os campos da seção 9 do REPERTORIO. Adicionar personagem novo = adicionar um objeto e um `.vrm`, sem mexer em lógica.
- Comece com 4: **Luma** (professora, crianças), **Teo** (matemático), **Rafa** (engenheiro), **Nina** (cientista). Se eu colocar mais `.vrm` na pasta, o seletor deve mostrar só os personagens que têm arquivo.
- Interface do seletor: faixa de cartões com miniatura, nome e uma linha de papel. **A miniatura sai de um render do próprio `.vrm`** (captura do canvas após carregar). Não use imagens geradas.
- Ao trocar: cancela fala e requisição em andamento, descarta o modelo anterior (`VRMUtils.deepDispose`), carrega o novo com transição curta, troca voz, persona, atalhos e paleta. Histórico de conversa **por personagem**.
- Carregar de forma preguiçosa: só o personagem ativo fica em memória.
- Lembrar o último personagem escolhido.

### 2. Como Teo e Rafa resolvem problemas

Implemente exatamente o método da seção 9 do REPERTORIO.

- Separe **o que é falado** do **que aparece no quadro**. Passos, contas e resultado aparecem no quadro; a fala só carrega o essencial. Escolha o mecanismo (marcadores por linha, JSON, o que for mais robusto), justifique em uma frase e teste com respostas reais e com respostas malformadas.
- **Contas não vão no modelo.** Implemente a função `calcular(expressao)` com `mathjs` (avaliação segura, sem `eval`) e exponha ao Gemini via function calling. Confirme na documentação atual do Gemini como declarar a ferramenta. Se o modelo devolver número que não veio da função, o quadro deve mostrar só o que veio da função.
- Quadro: números e expressões com fonte que distinga `1`, `l` e `I`, e `0` e `O`. Sem biblioteca de fórmula a menos que seja necessária; se for, justifique.
- Luma mantém o `RULES` atual e as travas de segurança para crianças. Teo e Rafa têm regras próprias na seção 9.

### 3. Voz: Kokoro

Crie um **adaptador de TTS** com uma interface única (`falar(texto, voz) → fluxo de áudio`) e implementações trocáveis:

1. `kokoro-server`: Kokoro-FastAPI em `http://localhost:8880` (`POST /v1/audio/speech`). Vozes PT-BR: `pf_dora`, `pm_alex`, `pm_santa`.
2. `kokoro-browser`: `kokoro-js`, com `device: "webgpu"` quando disponível e `wasm` como alternativa.
3. `webspeech`: o que existe hoje, como último recurso.

**Atenção, achado da pesquisa:** `kokoro-js` no navegador provavelmente **não expõe vozes em português** (só en-US e en-GB). Rode `tts.list_voices()` e registre o resultado real. Não assuma. Se não houver português, o `kokoro-server` vira o caminho principal para PT-BR, e o `kokoro-browser` fica só para personagens em inglês. Diga isso a mim de forma explícita.

Requisitos:
- Configurações: escolher o motor, endereço do servidor, e botão "testar voz". Detectar automaticamente se o servidor responde e mostrar o estado.
- Streaming do Gemini (`streamGenerateContent`) → dividir em sentenças → sintetizar a N+1 enquanto a N toca.
- Tocar por `AudioContext`, com o nó exposto para o lip sync.
- Botão "parar" cancela fila, requisição HTTP e áudio.
- Testar a chamada ao servidor no navegador (CORS). Se falhar, documentar a correção no README.
- Não dependa de timestamps por palavra do Kokoro-FastAPI (há issue aberta sobre `timestamps: null`).
- Só há 3 vozes PT-BR; personagens vão compartilhar voz. Diferencie por `speed` e, se o servidor permitir, por mistura de vozes.

### 4. Lip sync e corpo

- Boca guiada **pelo áudio que está tocando**. Comece com RMS → `aa`, com suavização e gate no silêncio. Depois teste `wlipsync` (vogais). Fique com o que realmente parecer melhor, comparando os dois lado a lado num quadro de teste, e mantenha o RMS como fallback.
- Piscadas naturais. Olhar via `vrm.lookAt` (segue o rosto do usuário quando a câmera está ligada; caso contrário, um olhar de repouso discreto).
- Corpo com **VRMA** (`idle`, `talk`, `think`, `greet`) usando `@pixiv/three-vrm-animation`. Remova o `rotation.z = ±1.2` dos braços. Se o clipe não existir, cair para `idle`. Nunca improvisar pose em código.
- Enquadramento automático do rosto por personagem (usar `enquadramento` do dado e a posição do osso `head`).

### 5. Webcam

Use MediaPipe Face Landmarker (tudo local). Implemente, nesta ordem, e pare em cada degrau para testar:

1. Ligar e desligar, com permissão explícita e indicador visível.
2. Presença (rosto apareceu → cumprimenta; sumiu por N s → volta ao idle).
3. Olhar (avatar acompanha a posição do rosto).
4. Reação a sorriso.
5. Modo espelho (opcional, desligado por padrão), com filtro One Euro para tirar tremor.
6. Sinal de dúvida: **só se sobrar tempo**, marcado experimental, limiar ajustável. Se os testes mostrarem falso positivo demais, não entregue esse.

Privacidade, sem exceção: câmera desligada por padrão; nenhum frame gravado, salvo ou enviado a qualquer API; parar as tracks ao desligar; limitar a taxa de inferência; pausar com a aba oculta. Mostre essas garantias no diálogo de configurações, em uma frase clara.

### 6. Interface e design

- Rode a skill de design escolhida em modo "teach/init" primeiro e registre a direção visual (uma página curta `DESIGN.md`).
- Cada personagem tem paleta e tratamento próprios definidos **nos dados**, não em CSS duplicado.
- O quadro de resolução (Teo, Rafa) é um elemento de primeira classe, não um balão de fala.
- Estados visíveis: ocioso, ouvindo, pensando, falando, erro, servidor de voz fora do ar, câmera ligada.
- Acessibilidade: contraste, foco, alvos de toque de 44 px ou mais, e o texto falado sempre visível.
- Textos de interface e falas dos personagens seguem a seção 10 do REPERTORIO: específicos, sem enchimento, sem abertura de frase genérica.

### 7. Estrutura e execução

Módulos ES sem bundler, servidos por HTTP estático:

```
index.html
src/scene.js  src/avatar.js  src/characters.js  src/brain.js
src/tts/index.js  src/tts/kokoro-server.js  src/tts/kokoro-browser.js  src/tts/webspeech.js
src/lipsync.js  src/camera.js  src/board.js  src/ui.js  src/storage.js
assets/avatars/*.vrm  assets/avatars/CREDITS.md
assets/animations/*.vrma
README.md  DESIGN.md  repertorio/REPERTORIO.md
```

O `README.md` explica em passos curtos: onde baixar `.vrm` e VRMA, como subir o Kokoro-FastAPI (Docker), como rodar o servidor estático e como adicionar um personagem.

## COMO TRABALHAR

Entregue em marcos. Ao fim de cada um, rode a verificação e me mostre o resultado antes de seguir.

| Marco | Conteúdo | Verificação mínima |
|---|---|---|
| M1 | Módulos separados + carga do `.vrm` + remoção do avatar procedural e do cenário de caixas | Página abre, VRM aparece, sem erro no console |
| M2 | Seletor de personagem + dados + histórico por personagem | Trocar 4 vezes seguidas sem vazar memória nem erro |
| M3 | Adaptador TTS + Kokoro + streaming por sentença | Áudio real tocando, "parar" funciona |
| M4 | Lip sync + VRMA | Comparativo RMS × wlipsync, escolha justificada |
| M5 | Cérebro dos personagens + quadro + `calcular` | 10 problemas de teste, incluindo um mal formulado |
| M6 | Webcam degraus 1 a 5 | Testar com câmera real; sem câmera, simular e dizer que foi simulado |
| M7 | Design final, detector anti-slop, README | `impeccable detect` limpo ou justificado |

Testes automatizados quando possível (Playwright headless para abrir a página, trocar personagem e checar console; testes unitários do parser do quadro e de `calcular`). Onde não for possível ouvir ou ver, diga e me diga o que eu devo conferir na mão.

## CRITÉRIOS DE ACEITE

- Nenhum personagem é gerado por código. Sem `.vrm`, tela de erro.
- Trocar de personagem muda modelo, voz, persona, atalhos e paleta, sem recarregar a página.
- A voz é Kokoro (servidor ou navegador) e o estado do motor é visível. Se o navegador não tiver português, o relatório diz isso.
- A boca acompanha o áudio real.
- Teo confere o resultado e usa `calcular` para aritmética.
- Câmera desligada por padrão, e nada de vídeo sai do navegador.
- `repertorio/REPERTORIO.md` atualizado com tudo que foi descoberto.

## O QUE NÃO FAZER

- Não gerar personagem, cenário ou textura em código.
- Não usar Ready Player Me.
- Não usar versões flutuantes (`@3`, `latest`).
- Não deixar `try/catch` vazio.
- Não usar emoji como ícone.
- Não escrever "funciona" sem executar.
- Não ampliar o escopo. Se tiver ideia extra, anote em REPERTORIO seção 12 e pergunte.

## FORMATO DA RESPOSTA FINAL

1. O que foi feito, por marco, com selo `TESTADO` ou `NÃO TESTADO`.
2. Resultado do checklist dos `.vrm`.
3. Resultado real de `tts.list_voices()` e a decisão de TTS que decorreu disso.
4. Skills usadas e as que faltaram.
5. Lista curta do que eu preciso conferir manualmente.
6. Problemas conhecidos, sem suavizar.

Se alguma regra acima entrar em conflito com o que for possível fazer, pare e me pergunte em vez de contornar.
