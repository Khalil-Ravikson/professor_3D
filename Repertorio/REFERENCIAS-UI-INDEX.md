# Índice de referências de interface

Este arquivo mora em `repertorio/REFERENCIAS-UI-INDEX.md`.

Pasta das capturas: `repertorio/ui/`. Salve cada imagem com nome numerado (`01-seletor-korix.webp`; se você usou outro nome, ajuste aqui) e registre aqui.
São referências **privadas** de padrão. Não redistribuir, não copiar marca, nome nem ilustração, não commitar em repositório público.

Como preencher cada entrada: o que **levar** (padrão, estrutura, hierarquia) e o que **não levar** (efeito, marca, arte, texto).

Onde procurar mais (seção 28.5 do REPERTORIO): Game UI Database (filtrar Character Select + 3D Stylized + PEGI 3 ou 7), Interface In Game, Dribbble ("character select screen"), Figma Community ("Hero Selection UI Kit", conferir licença).

---

## 01. Seleção de personagem de jogo (marca "KORIX")

- **Arquivo:** `Repertorio/ui/01-seletor-korix.webp.webp` (1024x768; o nome tem `.webp` duas vezes, como o dono salvou)
- **Fonte:** captura enviada pelo dono. Autor e página original não informados.
- **Tipo:** Character Selection + Showcase, paisagem.
- **Levar:**
  - roleta vertical de retratos circulares, selecionado maior com anel e seta;
  - personagem grande no centro, passando da moldura, sobre pódio;
  - nome enorme, rótulo de papel, descrição de duas linhas;
  - três indicadores segmentados de perfil;
  - botão largo com cantos chanfrados;
  - contador de elenco e cartões dos próximos, com slot vazio.
- **Não levar:** brilho, gradiente com tom violeta, cartões translúcidos, a marca "KORIX", o texto "Let's Play!", a arte da personagem, qualquer nome de classe ou de personagem.
- **Paleta (amostrada em 06/10/2026, cor dominante por região com Pillow; valores aproximados, a imagem é JPEG/WebP comprimida):**

  | Papel | Hex |
  |---|---|
  | Fundo, topo | `#0c1c3e` |
  | Fundo, meio | `#24518a` |
  | Fundo, parte baixa (névoa) | `#50709a` |
  | Pódio | `#e1e2e7` |
  | Acento (botão principal, anel, "+") | `#ff2c59` |
  | Indicador amarelo | `#ffea44` |
  | Indicador verde | `#43fd4c` |
  | Indicador ciano | `#49fffb` |
  | Nome grande | `#ffffff` |

  Os três indicadores são cores chapadas e saturadas. A regra I1 pede **um** acento e três cores de perfil, e é o que a imagem tem. O tom violeta que aparece na névoa e nos cartões é o que não se leva.
- **Tipografia (a identificar):** o nome grande e o título "Liora" parecem uma sans neo-grotesca em peso Bold ou Semibold, no estilo de Inter ou SF Pro; o rótulo "Sprinter" é a mesma família em peso menor, cinza apagado. **Não consegui confirmar a família só pela imagem.** Escolha final da fonte vai no `DESIGN.md`, com o motivo.

## 02. Editor de personagem 3D (marca "Paparala")

- **Arquivo:** `Repertorio/ui/02-editor-paparala.webp.webp` (1600x1200)
- **Fonte:** captura enviada pelo dono. Autor e página original não informados.
- **Tipo:** editor de cena 3D com painéis, claro, paisagem.
- **Levar:**
  - árvore da cena à esquerda e propriedades à direita;
  - barra de ferramentas flutuante no topo;
  - barra de comando embaixo, com "+", modo, microfone e enviar;
  - cartões brancos de canto arredondado e sombra suave;
  - um único acento quente.
- **Não levar:** a marca "Paparala", o personagem, os nomes de estilos e de modelos, o texto de interface.
- **Paleta (amostrada em 06/10/2026):** fundo da cena `#f6f6f6`, painéis e cartões `#fdfdfd` a `#ffffff`, texto principal `#000000`, texto suave `#4d4d4d` a `#aaaaaa`, botão secundário `#e3e3e3`, **um** acento quente `#db652a` (visto nos tênis do personagem, não na interface; a interface é quase toda neutra).
- **Tipografia (a identificar):** sans neutra e legível, estilo Inter. Não confirmada.
- **Uso no projeto:** console do operador e barra de entrada da conversa.

## 03. Estúdio de personagem escuro (marca "AI Studio")

- **Arquivo:** `Repertorio/ui/Repertorio3.webp` (1600x1199). **Não estava no índice**: foi adicionado depois das duas primeiras.
- **Fonte:** captura enviada pelo dono. Autor e página original não informados.
- **Tipo:** editor de personagem 3D escuro com barra lateral, trilha de etapas no topo, prévia no centro e propriedades à direita, paisagem.
- **Levar:**
  - trilha de etapas numeradas no topo (Concept, Appearance, Voice, Personality, Animation, Export), que casa com o cadastro de personagem do console;
  - abas embaixo da prévia (Expression, Emotions, Animation, Idle Motion, Lip Sync, Camera), que casam com as abas que o console já tem;
  - cartão "Character Overview" com ficha de campos em duas colunas (nome, estilo, voz, animações, formato);
  - barra de ferramentas vertical sobre a prévia;
  - chips de sugestão embaixo do campo de texto.
- **Não levar:** o gradiente violeta e a névoa roxa, o brilho nos cartões e botões, o botão "Upgrade Plan", o logotipo, a personagem, os textos. **Tudo o que a regra I1 proíbe está nesta imagem**, então ela só serve como padrão de estrutura, nunca de aparência.
- **Paleta (amostrada):** fundo do app `#0a0c10`, cartões `#0f1016`, botão principal `#796bcd` (violeta, **não usar**).
- **Uso no projeto:** só o console do operador, e só a estrutura.
- **Resultado em 08/10/2026 (prompt 07, V1 a V8):** a estrutura foi levada para o Photo Booth do visualizador (`src/photobooth.js`): faixa de miniaturas geradas dos próprios clipes, painel com abas (Animações, Expressões, Rastreamento, Fundo e foto), pausa e botões em pílula. **A cor não foi levada**: o dono decidiu seguir o visual claro do Photo Booth, e esse visual passou a valer para todas as telas (fundo `#f7f9fd` a `#e4eaf5`, texto `#182033`, o nome do personagem em contorno ao fundo, ação em `#c81e45` para a Luma e `#b3420f` para o Teo). A captura do Photo Booth do VRoid Hub (`03-vroidhub-photobooth.png`) **continua faltando**; as decisões vieram dos wireframes aprovados (`wireframes/photobooth.html`) e da descrição do prompt.

---

## Modelo para novas entradas

```
## NN. Título curto

- Arquivo:
- Fonte (URL, autor):
- Tipo:
- Levar:
- Não levar:
- Paleta (a amostrar):
- Tipografia (a identificar):
- Uso no projeto:
```

---

## 04. Painel "AI Studio" de criação de personagem (captura sem marca de origem clara)

- **Arquivo:** `Repertorio/ui/Repertorio3.webp` (1600 x 1199; enviado pelo dono; **não é** a captura do Photo Booth do VRoid Hub que o prompt 07 pede como `03-vroidhub-photobooth.png`, que continua faltando)
- **Fonte:** captura enviada pelo dono. Autor e página original não informados. Privada: não redistribuir nem commitar.
- **Tipo:** painel escuro de criação de personagem 3D, paisagem.
- **Levar (só estrutura):** trilho vertical de ferramentas à esquerda do palco (girar, zoom, pose, luz, fundo); categorias à direita; tira de miniaturas de expressão com barra de reprodução embaixo; passos numerados no topo.
- **Não levar:** o roxo e o gradiente violeta, o painel escuro, o nome "AI Studio", o logotipo, os créditos, o botão de plano, os textos e a arte do personagem.
- **Paleta (amostrada por olho, não medida):** fundo quase preto, acento violeta, laranja nas peças. Fora das regras do projeto (sem gradiente violeta, sem cara de IA).
- **Uso no projeto:** decisão do dono em 08/10/2026: seguir o Photo Booth claro do prompt 07 e aproveitar desta imagem só a estrutura (V1, `wireframes/photobooth.html`).

