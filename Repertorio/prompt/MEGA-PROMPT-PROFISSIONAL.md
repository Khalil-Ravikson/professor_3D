# MEGA PROMPT 4 (versão 2): aceno simples, catálogo de animações e acabamento profissional

> **Pasta de referência:** tudo fica em `repertorio/`.
> - `repertorio/REPERTORIO.md` é a fonte de verdade do projeto.
> - `repertorio/REFERENCIAS-UI-INDEX.md` registra as referências de interface.
> - `repertorio/ui/` guarda as capturas de referência (imagens `.webp`).
> Onde este texto citar `REPERTORIO.md`, leia `repertorio/REPERTORIO.md`.

Atualizado depois que o dono testou o pacote VRMA e gostou dos clipes.
Cole abaixo da linha na mesma ferramenta de código dos prompts anteriores.

Antes:
- Substitua o `repertorio/REPERTORIO.md` pelo novo (seção 25 foi ampliada: 25.1b, 25.1c, 25.6 e 25.7).
- Instale a skill `vrm-avatar-web` (zip entregue antes) em `.claude/skills/` do projeto.

---

## PAPEL

Você é um engenheiro front-end sênior com olho de direção de arte e cuidado de produto. O app já tem voz, lip sync, webcam, cache, RAG da UEMA e controle de orçamento. Agora o trabalho é **dar vida e acabamento**: um aceno simples, um catálogo de animações por caso de uso, fluxo de sessão completo, identidade, áudio, robustez de quiosque e acessibilidade.

Responda e comente em português do Brasil.

## ESTADO ATUAL DOS ARQUIVOS (informado pelo dono)

- `assets/avatars/8590256991748008892.vrm`: sample baixado do VRoid Hub. **Mantenha o nome original** e mapeie no `characters.js`. Só renomeie se eu pedir. Leia autor e licença nos metadados do arquivo e registre em `assets/avatars/CREDITS.md`.
- Pasta com o pacote **VRMA_MotionPack** (7 clipes do VRoid Project: Show full body, Greeting, Peace sign, Shoot, Spin, Model pose, Squat, na numeração oficial `VRMA_01` a `07`). **Eu já testei e gostei dos clipes.**
- Só **um** `.vrm`. Teo, Rafa e Nina ficam sem modelo e **não aparecem no seletor** até existir arquivo. Não improvise modelo para eles.

## O QUE EU QUERO DESTA RODADA

1. Um **aceno simples**: levantar o braço e acenar. Mais discreto que os clipes do pacote.
2. **Mais animações para casos de uso reais** (repouso, falando, pensando, "não sei", aplaudir e outros), com um catálogo claro do que existe e do que falta.
3. Acabamento profissional.

## PASSO 0: LEIA, INSTALE E AUDITE

1. Leia o `repertorio/REPERTORIO.md` inteiro, com atenção às seções 3, 10 e 25 a 27 (inclusive 25.1b, 25.1c, 25.6 e 25.7) e ao seu log na seção 12.
2. **Skills.** Veja quais estão instaladas e diga quais usou, em que etapa: `vrm-avatar-web`, `threejs-animation`, `threejs-loaders`, `threejs-fundamentals`, `impeccable`, `design-taste-frontend`. Se faltar alguma, diga o comando de instalação (seção 8 do REPERTORIO) e siga com as regras do REPERTORIO.
3. **Contexto de design:** se a skill `impeccable` existir, rode `impeccable context` uma vez. Sem `PRODUCT.md`, use `init`; use `document` para gerar o `DESIGN.md` do código atual. Escreva a linha "Design Read" da skill `design-taste-frontend` antes de codar.
4. **Linha de base:** rode o app e registre o estado real (FPS, tempo até a primeira fala, memória após 10 trocas). Tudo abaixo é medido contra isso.
5. Confira versões com `npm view`. Leia o exemplo oficial `loader-plugin.html` do `three-vrm-animation` antes de escrever código. Fixe versão exata e verifique a compatibilidade com o Three.js do projeto.
6. **Estenda o painel de configurações e o painel do operador que já existem.** Não reescreva nem duplique.

## REGRAS QUE CONTINUAM VALENDO

- Só `.vrm` e `.vrma` prontos. **Nenhuma pose, personagem ou cenário criado em código**, com **uma única exceção** (R-aceno, abaixo).
- Sem cara de IA no visual, no texto e no código (seção 10 do REPERTORIO). Sem travessão (—) em interface e em falas dos personagens.
- Selos `TESTADO` / `NÃO TESTADO` em tudo. Não invente API.
- Não amplie o escopo. Ideia extra vai para a seção 12 do REPERTORIO, com pergunta.
- Verifique em **passes limitados**: construir completo, inspecionar uma vez em lote (retrato e paisagem), corrigir tudo, confirmar no máximo mais uma vez e parar.
- Crianças: nada de nome, escola, gravação de áudio ou de imagem.
- **Referência de estilo atual:** samples do VRoid Studio. Ignore a meta semi-realista do prompt de refinamento (R1). Mantenha o MToon com a aparência padrão do modelo e ajuste só luz, fundo e sombra de contato.

## REGRAS NOVAS

**P1. Nunca confie no número do arquivo `.vrma`.** Fontes públicas divergem. Identifique cada clipe **vendo-o rodando**.

**P2. Clipes têm licença.** O pacote do VRoid exige a frase de crédito do próprio readme e proíbe redistribuição: não vai para repositório público. Mixamo tem termos da Adobe; leia os atuais antes de redistribuir. Registre a licença de cada clipe em `assets/animations/CREDITS.md`.

**P3. Identidade da UEMA só com material oficial.** Não recrie nem imite o logotipo. Sem material meu, use identidade neutra e diga isso.

**R-aceno (exceção única).** Um aceno procedural mínimo só é permitido se: (a) nenhum clipe pronto servir, (b) a criação do clipe em editor falhar ou não for viável, e (c) **eu aprovar no chat**. Detalhes no marco P2.

**P4. Modo infantil.** O clipe "Shoot" (gesto de arma de dedo) fica desligado no modo infantil por padrão. Ligável pelo operador.

## O QUE FAZER, EM MARCOS

Um marco por vez. Ao fim de cada um: verificar, mostrar o resultado e só então seguir.

### P1. Catálogo de animações por caso de uso e galeria no painel

1. **Inventário.** Carregue cada `.vrma` da pasta no `.vrm` existente. Gere uma **folha de contato** por clipe (4 instantes) e diga o que cada um mostra. Anote duração, se parece laço, deslocamento do quadril, problemas (braço atravessando roupa, cabelo tremendo).
2. **Catálogo em dados** (`animacoes.json` ou equivalente), um registro por clipe: `id`, `arquivo`, `descricao`, `casoDeUso`, `loop`, `duracao`, `intensidade` (1 a 3), `infantilOk`, `origem`, `licenca`, `status` (`ativo`, `desligado`, `lacuna`, `procedural`).
3. **Proposta de mapeamento** (use a tabela 25.6 do REPERTORIO como ponto de partida e **corrija com o que você viu**): cumprimento, repouso, falando, apresentar, comemorar, atração, pensando, ouvindo, "não sei", aplaudir, apontar, desculpa, agradecer. Para os que o pacote não cobre, o `status` é `lacuna`.
4. **Lista de compras de animação.** Para cada lacuna, em ordem de prioridade (alta: aceno simples, idle em laço, falando; média: pensando, ouvindo, "não sei"; baixa: aplaudir, apontar, desculpa, agradecer), escreva: nome, duração desejada, laço ou não, pose inicial e final neutras, quadril sem deslocamento, sem expressão facial embutida, e **onde procurar** (seção 25.1b: Mixamo convertido, biblioteca do VTubeMe, Librn Editor, Blender com VRM Add-on, VRoid Hub, BOOTH). **Eu é que baixo.** Não baixe de serviço com login por conta própria.
5. **Galeria de animações no painel do operador.** Lista todos os clipes do personagem com botão de tocar, pausar e velocidade, interruptor ligar/desligar, marca "ok para criança", e a descrição que você anotou. É onde eu confirmo o que cada clipe mostra e escolho quais entram. Persistir a escolha nos dados.
6. **Aceite:** tabela clipe × caso de uso, folhas de contato salvas, lista de compras com prioridade e a galeria funcionando no painel, com captura de tela.

### P2. Aceno simples (levantar o braço e acenar)

Siga a ordem da seção 25.7 e **pare em cada degrau para me perguntar se serviu**:

1. **Clipe pronto.** Procure e me diga as opções (Mixamo convertido, VTubeMe, VRoid Hub, BOOTH), com licença de cada uma. Eu baixo e coloco na pasta. Quando chegar, carregue, avalie (braço, quadril, pose inicial e final) e coloque na galeria.
2. **Criar com editor.** Se não houver clipe adequado, escreva um passo a passo curto para eu criar o aceno (Librn Editor ou Blender com o VRM Add-on) e exportar `.vrma`.
3. **Último recurso, só com a minha aprovação explícita no chat:** aceno procedural mínimo.
   - Ossos humanoides **normalizados** (`rightUpperArm`, `rightLowerArm`, `rightHand`).
   - Parâmetros em **dados** (ângulos, 0,4 s para subir, 3 a 4 oscilações, 0,4 s para descer; total de 2 a 3 s).
   - Camada sobre o idle com peso que sobe e desce; nunca no meio de uma palavra.
   - Validado em cada `.vrm` (braço não atravessa cabelo nem roupa; se atravessar, reduzir o ângulo para aquele modelo, em dados).
   - Marcado `procedural` no catálogo e no relatório final.
- **Aceite:** capturas do aceno em sequência (subir, acenar, descer) e o tempo medido entre o gatilho e o início do gesto.

### P3. Sistema de animação (máquina de estados)

Seção 25.4 do REPERTORIO, com as skills `threejs-animation` e `vrm-avatar-web`.

- Um `AnimationMixer` por personagem. Crossfade de 0.2 a 0.4 s. Gestos de uma vez com `LoopOnce` e `clampWhenFinished`, voltando ao `idle` no evento `finished`.
- **Repouso:** se não houver idle em laço, o personagem fica na pose padrão do modelo e isso é registrado como lacuna prioritária. Camada aditiva de respiração só sobre um clipe-base.
- Por quadro: `mixer.update(dt)` e depois `vrm.update(dt)`.
- Estados: `idle`, `listening`, `thinking`, `talking` e gestos (`aceno`, `despedida`, `comemora`, `nao-sei`, `aplaude`, `aponta-quadro`, `desculpa`, `agradece`). **Cada estado só usa clipe com `status` `ativo` no catálogo.** Os demais caem para `idle` e ficam registrados.
- Prioridade: fala e lip sync, depois emoção, depois clipe. Mesmo gesto não repete duas vezes seguidas; intervalo mínimo configurável.
- O LLM só pede gestos que existem e estão ativos. Pedido inválido é ignorado e registrado.
- **"Não sei":** quando o RAG não encontrar resposta, tocar o gesto de encolher os ombros se existir; senão, só a fala.
- **Modo calmo** (configuração e `prefers-reduced-motion`): sem gestos amplos, só respiração e piscar.
- Dono do olhar definido: ou o clipe ou o seu `lookAt`. Pausar mixers com a aba oculta.
- **Aceite:** capturas dos quadros-chave de cada gesto em retrato e paisagem; teste automatizado de que o gesto nunca corta uma sentença no meio e de que pedido inválido do LLM é ignorado.

### P4. Cumprimento e despedida com o aceno

- **Cumprimento:** rosto detectado após ausência, ou início de sessão pelo operador, ou toque na tela. A fala curta (do pacote de áudio pré-gravado) começa cerca de 300 ms depois do início do aceno.
- **Despedida:** fim de sessão ou inatividade, com aceno e frase curta, e depois limpeza do histórico.
- **Aceite:** sequência do ciclo completo (cumprimento, conversa, despedida) e o tempo medido entre gatilho e início do gesto.

### P5. Fluxo de sessão profissional

Seção 26, itens 1 e 2. Use `impeccable shape` para planejar antes de codar.

- Etapas: atração, cumprimento, consentimento de câmera e microfone, conversa, despedida, limpeza. Cada uma com texto curto e um único próximo passo visível.
- Tela do personagem no modo **Experience** da skill; painel do operador no modo **Operate**.
- Consentimento: câmera e microfone desligados por padrão, com uma frase sobre o que acontece e o que não é gravado.
- Use `onboard` e `clarify` para os textos e `adapt` para retrato e paisagem.
- **Aceite:** capturas de cada etapa; checklist de texto (sem travessão, sem enchimento, sem abertura genérica).

### P6. Identidade e acabamento visual

- `DESIGN.md` de uma página: tipografia com o motivo, paleta, espaçamento, movimento. Registre os três botões da `design-taste-frontend` (sugestão: variância 3 a 4, movimento 3 a 4 só na interface, densidade 4 a 5).
- Movimento da interface só em `transform` e `opacity`, respeitando `prefers-reduced-motion`.
- Tela de carregamento com progresso real e mensagens curtas.
- **Tela de créditos** gerada dos `CREDITS.md` de modelos e clipes.
- Passe `polish` e depois `delight`, e só então rode o detector (`npx impeccable detect .`).
- **Aceite:** capturas antes e depois; detector limpo ou justificado.

### P7. Licença e conformidade no carregamento

- Ao carregar cada `.vrm`, leia autor e licença dos metadados (os campos mudam entre VRM 0.x e 1.0; inspecione o objeto). Registre no log do operador. **Se a licença não permitir o uso previsto, bloqueie e avise.**
- Para os samples do VRoid, lembre: uso livre incluindo eventos, sem crédito obrigatório, **mas** nada na interface pode sugerir que a pixiv ou o VRoid apoia ou recomenda o evento (seção 2 do REPERTORIO).
- Verifique as licenças das dependências (cuidado com AGPL). Gere `THIRD-PARTY.md`.
- **Aceite:** relatório por modelo e por clipe (autor, licença, decisão) e a lista de dependências com licença.

### P8. Áudio profissional

- Destravar o áudio no primeiro toque. Controle de volume visível. Intervalo curto e constante entre sentenças. Reduzir o volume de fundo quando o usuário fala.
- Áudios pré-gravados com volume homogêneo (normalização, por exemplo com `ffmpeg`; confira o filtro e o alvo na documentação antes).
- **Aceite:** volume dos áudios pré-gravados antes e depois, com os números.

### P9. Robustez de quiosque

Use `impeccable harden`, `optimize` e `audit`.

- Tratar `webglcontextlost` e `webglcontextrestored` (recarregar o modelo sem recarregar a página).
- Vigia que recarrega a página se o laço de renderização travar. Tela de erro amigável. Versão do app visível só no painel do operador.
- Painel do operador com diagnóstico: FPS, memória, latência, gasto, estado de cada serviço.
- Acessibilidade: legendas sempre visíveis, região `aria-live`, contraste, foco por teclado, alvos de toque grandes, modo calmo.
- Textos de interface num arquivo só (`strings.pt-BR.js`).
- **Teste de longa duração:** pelo menos 4 horas contínuas com sessões simuladas, medindo memória, FPS e erros. Se não puder, diga e rode o máximo.
- **Aceite:** relatório do teste e teste de recuperação após perda de contexto WebGL forçada de verdade.

### P10. Avaliação e fechamento

- Comando único que roda: detector anti-slop, testes de animação (P3), verificação de licenças (P7), capturas de quadros-chave e relatório de desempenho.
- `README.md`: como adicionar um clipe, como ligar ou desligar um clipe na galeria, como adicionar um gesto ao inventário de um personagem, onde baixar o pacote VRMA, como regenerar a folha de contato.
- `repertorio/REPERTORIO.md`, seção 12: tudo que descobriu (`data | o que testou | resultado | decisão`), incluindo o que cada clipe realmente mostra.
- Proponha ajustes na skill `vrm-avatar-web` com base no que aprendeu; **não altere sem eu aprovar**.

## O QUE NÃO FAZER

- Não inventar pose, gesto ou clipe em código, exceto o aceno procedural, e só com a minha aprovação.
- Não confiar no número do arquivo `.vrma`.
- Não renomear o `.vrm` sem eu pedir.
- Não commitar `.vrma` do VRoid nem FBX do Mixamo em repositório público.
- Não recriar nem imitar o logotipo da UEMA; não sugerir apoio da pixiv ou do VRoid.
- Não usar travessão (—), ponto de status decorativo, selo de versão na tela do público ou faixa de local e hora.
- Não deixar `try/catch` vazio.
- Não afirmar que algo funciona sem ter executado.
- Não entrar em laço de verificação sem fim.

## FORMATO DA RESPOSTA FINAL

1. Linha de base e resultado final (FPS, tempo até a primeira fala, memória, tempo entre gatilho e aceno).
2. Resultado por marco, com selo `TESTADO` ou `NÃO TESTADO`.
3. Tabela do catálogo: clipe, o que mostra, caso de uso, status.
4. Lista de compras de animação com prioridade e onde procurar.
5. Se o aceno procedural foi usado, dizer claramente e mostrar a aprovação.
6. Relatório de licenças (modelos, clipes, dependências).
7. Relatório do teste de longa duração.
8. Skills usadas, em que etapa, e as que faltaram.
9. O que eu preciso conferir manualmente (frase de crédito do readme do VRoid, termos atuais do Mixamo, material oficial de identidade da UEMA).
10. Problemas conhecidos, sem suavizar.

Se alguma regra entrar em conflito com o que for possível fazer, pare e pergunte em vez de contornar.
