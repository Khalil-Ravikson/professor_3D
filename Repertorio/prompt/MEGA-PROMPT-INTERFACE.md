# MEGA PROMPT 5: interface estilo jogo (seleção, vitrine e console do operador)

> **Pasta de referência:** tudo fica em `repertorio/`.
> - `repertorio/REPERTORIO.md` é a fonte de verdade do projeto.
> - `repertorio/REFERENCIAS-UI-INDEX.md` registra as referências de interface.
> - `repertorio/ui/` guarda as capturas de referência (imagens `.webp`).
> Onde este texto citar `REPERTORIO.md`, leia `repertorio/REPERTORIO.md`.

Cole abaixo da linha na mesma ferramenta de código dos prompts anteriores.

Antes:
- A pasta `repertorio/` já existe no projeto, com esta estrutura:
  ```
  repertorio/
    REPERTORIO.md                         (substitua pelo novo, com as seções 28 a 31)
    REFERENCIAS-UI-INDEX.md
    ui/
      (as duas imagens de referência)
  ```
- Mantenha os nomes que você deu às imagens. A IA lê todas as imagens de `repertorio/ui/` e ajusta o índice aos nomes reais. Para orientar: a tela de jogo azul (personagem de casaco amarelo) é a referência do **seletor público**; o editor 3D claro (personagem barbudo) é a referência do **console do operador**.
- Coloque `repertorio/ui/` no `.gitignore` (imagens de terceiros).
- Coloque o segundo `.vrm` (o novo Teo) em `assets/avatars/`, ao lado do que já existe.

---

## PAPEL

Você é um engenheiro front-end sênior com formação em design de interface de jogos. O app já tem personagens, voz, lip sync, animações, RAG da UEMA, cache e controle de orçamento. Agora o trabalho é **trocar a cara do produto**: uma interface com pegada de jogo, com **Character Selection** e **Character Showcase** para o público, e um **console do operador** claro para quem opera.

Responda e comente em português do Brasil.

## ESTADO ATUAL DOS ARQUIVOS (informado pelo dono)

- `assets/avatars/8590256991748008892.vrm`: sample baixado do VRoid Hub. Mantenha o nome. Hoje é a **Luma**.
- Um **segundo `.vrm`**, que o dono achou para o **Teo**, em `assets/avatars/`. **O nome do arquivo não foi informado.** Liste a pasta, mostre os arquivos e **pergunte qual é o do Teo** antes de mapear. Não adivinhe.
- Pasta de `.vrma` com o pacote VRMA_MotionPack.
- Rafa e Nina continuam sem modelo e ficam como **"Em breve"** no seletor.
- Duas imagens de referência de interface em `repertorio/ui/`.

## O QUE EU QUERO

1. Uma interface pública com cara de **seleção de personagem de jogo**: roleta de retratos, personagem grande em um pódio, cartão com papel, nome e descrição, indicadores de perfil e um botão grande para conversar.
2. Um modo **vitrine** que percorre os personagens sozinho quando ninguém está usando.
3. Um **console do operador** claro, no estilo do editor 3D da segunda referência, onde ficam animações, vozes, orçamento, armazenamento e cadastro de personagem.
4. Que **adicionar um personagem seja só soltar um `.vrm` e preencher dados**.

## PASSO 0: LEIA, OLHE E AUDITE

1. Leia o `repertorio/REPERTORIO.md` inteiro, com atenção às seções 10, 14, 15, 26, 27, 28 e 29, e ao seu log na seção 12.
2. **Olhe as duas imagens** em `repertorio/ui/` e confirme a leitura da seção 28.1. Corrija o que estiver errado. Extraia **por amostragem** a paleta de cada uma (valores em hexadecimal) e identifique, o melhor que puder, a família tipográfica do nome grande. Preencha o `repertorio/REFERENCIAS-UI-INDEX.md`.
3. **Skills.** Diga quais usou e em que etapa: `impeccable` (`context`, `shape`, `animate`, `onboard`, `clarify`, `adapt`, `harden`, `optimize`, `audit`, `polish`, `delight`), `design-taste-frontend`, `frontend-design`, `vrm-avatar-web`, `threejs-fundamentals`, `threejs-animation`. Se faltar alguma, diga o comando de instalação e siga com as regras do REPERTORIO.
4. Se a skill `impeccable` existir, rode `impeccable context` uma vez; use `shape` para planejar a UX **antes** de codar. Escreva a linha "Design Read" da skill `design-taste-frontend` e registre os três botões (variância, movimento, densidade) com o motivo.
5. **Linha de base:** rode o app e registre FPS, tempo até a primeira fala, memória após 10 trocas e tempo de carga com e sem cache.
6. Liste as configurações e telas que já existem (painel de configurações, painel do operador, galeria de animações, laboratório de vozes, medidor de custo). **Estenda; não reescreva nem duplique.**

## REGRAS QUE CONTINUAM VALENDO

- Só `.vrm` e `.vrma` prontos. Nada de personagem, pose ou cenário criado em código. A exceção única do aceno simples continua como está no prompt 4.
- Sem cara de IA no visual, no texto e no código (seção 10). Sem travessão (—) em interface e em falas.
- Selos `TESTADO` / `NÃO TESTADO` em tudo. Não invente API.
- Não amplie o escopo. Ideia extra vai para a seção 12 do REPERTORIO, com pergunta.
- Verifique em **passes limitados**: construir completo, inspecionar uma vez em lote (retrato e paisagem), corrigir tudo, confirmar no máximo mais uma vez e parar.
- Crianças: nada de nome, escola, gravação de áudio ou de imagem.
- Estilo dos modelos: samples do VRoid. Mantenha o MToon com a aparência padrão do modelo.

## REGRAS NOVAS

**I1. Estrutura e hierarquia, não efeitos.** A referência azul usa gradiente profundo, anéis coloridos e brilho. Leve a **estrutura e a hierarquia**. Não leve: brilho neon, gradiente com tom violeta, cartões de vidro, partículas e faíscas. Fundo azul-marinho a azul profundo, **um** acento, três cores chapadas para o perfil. Os valores vêm da amostragem das imagens, não de chute.

**I2. Nada é copiado.** Não use a marca, os nomes, os textos nem a arte das referências ("KORIX", "Paparala", "Let's Play!", "Sprinter", "Liora"). O botão de conversar diz, por exemplo, "Conversar com Luma". Não reproduza as telas pixel a pixel. As imagens são referência de padrão.

**I3. "Perfil" é ficção declarada.** Os três indicadores de cada personagem (valores de 1 a 5, nos dados) são traços de personalidade inventados para o jogo. Nunca apresente como dado real sobre a UEMA ou sobre pessoas.

**I4. Sem arte inventada.** Retratos vêm de render do próprio `.vrm`. Personagem sem `.vrm` aparece como cartão **"Em breve"** com cadeado, sem silhueta nem ilustração gerada. O pódio é desenhado em **CSS** (elipse com sombra), nunca em geometria 3D.

**I5. Orçamento.** O botão "Ouvir voz" toca um áudio **pré-gravado e já em cache**. Ele nunca dispara chamada paga.

**I6. Acessibilidade primeiro.** Alvos de toque de 56 px ou mais no quiosque. Contraste AA, inclusive com texto sobre a cena 3D (use camada de contraste). Foco visível. Navegação por teclado. Respeitar `prefers-reduced-motion`. Movimento só em `transform` e `opacity`.

## TELAS

### A. Vitrine (atração)
Percorre os personagens sozinha, cada um na sua pose de assinatura, com nome e frase curta. **Qualquer toque ou rosto detectado** leva à seleção. Sem som automático.

### B. Seleção
Layout de referência (paisagem), nesta estrutura:
- **Esquerda:** roleta vertical de retratos circulares renderizados dos `.vrm`. O selecionado é maior e tem anel e uma seta de "tocar" saindo de um recorte em cunha. Slots sem modelo aparecem bloqueados.
- **Centro:** o personagem **vivo** (VRM carregado), grande, sobre o pódio em CSS, com a cabeça podendo ultrapassar a moldura do cartão. Pose de assinatura e respiração.
- **Direita:** rótulo de papel em cinza grande e apagado, **nome enorme**, descrição de duas linhas, três indicadores segmentados de perfil, contador de elenco (por exemplo "1/4"), botão "Ouvir voz".
- **Embaixo:** botão largo de cantos chanfrados, "Conversar com [nome]".
- **Canto inferior direito:** cartões inclinados com o anterior e o próximo.
- **Topo:** discreto, com o essencial (como funciona, idioma se houver, ajuda).

Troca de personagem por seta, roleta, deslize e teclado. Transição de 350 a 450 ms (deslize e escala), com troca de fundo, paleta e enquadramento, vindos **dos dados** do personagem.

**Retrato (celular em pé ou totem vertical):** empilhar vitrine, cartão e roster, como descrito na seção 28.2 do REPERTORIO.

### C. Conversa
Mesmo idioma visual. Personagem de um lado, quadro do outro. **Barra de comando inferior** inspirada na referência clara: botão "+" (menu), seletor de modo (guiada ou livre), microfone e enviar. Estados visíveis: ocioso, ouvindo, pensando, falando, erro, voz em plano B, câmera ligada. Legenda sempre visível.

### D. Console do operador (claro, estilo editor 3D)
Modo *Operate* da skill: clareza e consistência acima de expressão.
- **Esquerda, "Cena":** árvore com Câmera, Luz, Personagem, Fundo, e abas Cena e Ativos.
- **Centro:** prévia viva do personagem selecionado, com barra de ferramentas flutuante.
- **Direita, "Propriedades":** estilos de luz (miniaturas), cor de fundo (hexadecimal e opacidade), enquadramento, e as abas já existentes: **Animações** (galeria), **Vozes** (laboratório), **Orçamento** (medidor), **Armazenamento**.
- **Cadastro de personagem:** arrastar um `.vrm` da pasta, ver prévia, ler licença e metadados, preencher nome, papel, descrição, perfil (3 traços), voz, paleta, atalhos e animações, e salvar nos dados. Se a licença não permitir o uso previsto, bloquear e avisar.
- Texto e rótulos em português, num arquivo único de strings.

## O QUE FAZER, EM MARCOS

Um marco por vez. Ao fim de cada um: verificar, mostrar o resultado e só então seguir.

### I1. Direção visual e fundamentos
- `DESIGN.md` de uma página: leitura das referências, paleta amostrada, tipografia **com o motivo**, escala de espaçamento, raios, sombras, movimento. Fontes **hospedadas localmente** (quiosque pode ficar sem internet).
- Tokens em CSS (cores, espaçamento, raios, tempos), com os temas por personagem vindo dos dados.
- Wireframes estáticos em HTML, paisagem e retrato, das telas A, B, C e D. **Eu aprovo antes de seguir.**
- **Aceite:** `DESIGN.md`, `repertorio/REFERENCIAS-UI-INDEX.md` preenchido, wireframes e a minha aprovação.

### I2. Tela de seleção
- Roleta, pódio, cartão, perfil, botão, contador e cartões de próximos, com **dois personagens ativos** (Luma e Teo) e dois bloqueados (Rafa e Nina).
- Miniaturas renderizadas dos `.vrm` uma vez e guardadas em cache (IndexedDB), não a cada abertura.
- Só o personagem ativo carregado em memória. Troca sem vazar memória (`VRMUtils.deepDispose` do anterior).
- **Aceite:** capturas em retrato e paisagem; teste de 20 trocas seguidas sem erro de console e sem crescimento de memória.

### I3. Vitrine e "Ouvir voz"
- Ciclo automático com pose de assinatura (clipes ativos do catálogo; sem clipe, `idle`).
- Interrupção por toque ou rosto detectado. Retorno à vitrine por inatividade, com tempo configurável.
- "Ouvir voz" usa o áudio pré-gravado em cache. Se não houver áudio, o botão fica desabilitado e o motivo aparece. **Nunca** chama serviço pago.
- **Aceite:** sequência de capturas do ciclo; teste de que "Ouvir voz" não gera nenhuma chamada de rede paga.

### I4. Conversa
- Transição da seleção para a conversa mantendo o mesmo personagem na tela, sem recarregar o modelo.
- Barra de comando, estados, quadro, legenda. Reaproveite a máquina de estados de animação, o RAG e o medidor de custo que já existem.
- Use `onboard` e `clarify` para os textos de consentimento de câmera e microfone.
- **Aceite:** capturas de cada estado; fluxo completo seleção, conversa, despedida, volta à vitrine.

### I5. Console do operador
- Estenda o painel existente para o layout descrito em D. Reaproveite a galeria de animações, o laboratório de vozes, o medidor de custo e o painel de armazenamento.
- Cadastro de personagem com leitura de licença no carregamento.
- **Aceite:** adicionar um personagem de teste só pelo console, sem editar código, e vê-lo aparecer na roleta.

### I6. Teo com o novo `.vrm`
- Confirme comigo qual arquivo é o Teo. Registre autor e licença em `CREDITS.md` e leia os metadados.
- Enquadramento, luz, paleta e perfil do Teo, nos dados. Rode o checklist da seção 2 do REPERTORIO e a verificação de cada clipe ativo nesse modelo (braço atravessando roupa, quadril, cabelo).
- Persona do Teo ligada ao método de resolução de problemas e ao RAG (prompt 3).
- **Aceite:** tabela de validação do modelo e capturas do Teo na seleção e na conversa.

### I7. Acabamento e robustez
- Passe `adapt`, `harden`, `optimize` e `audit`; depois `polish` e `delight`; **só então** rode `npx impeccable detect .`.
- Teste de contraste do texto sobre a cena. Teste de toque (alvos de 56 px). Teste só com teclado.
- Qualidade adaptativa do render (já existe) agindo também na tela de seleção.
- **Aceite:** capturas antes e depois, relatório do detector, relatório de acessibilidade e FPS medido.

### I8. Fechamento
- `README.md`: como adicionar personagem (soltar `.vrm` e preencher dados, ou pelo console), como trocar paleta e perfil, como adicionar referências.
- `repertorio/REPERTORIO.md`, seção 12: tudo que descobriu, com a paleta amostrada e a tipografia escolhida.
- Lista final de pendências, sem suavizar.

## PRÓXIMOS PASSOS (apenas registrar; não implementar nesta rodada)

Registre na seção 12 do REPERTORIO e me lembre no relatório final. Detalhes na seção 31 do REPERTORIO.

1. **Motor de voz do Gemini** no laboratório de vozes. Se as amostras agradarem, vira voz de pré-gravação e, conforme qualidade e latência, voz premium ao vivo com teto de caracteres.
2. **ElevenLabs** no mesmo laboratório, em teste cego contra o Gemini e o Kokoro.
3. **Contagem de caracteres para o orçamento** (`npm run orcamento:falas`, seção 30.3): caracteres das falas fixas por personagem, segundos e tokens estimados, custo por provedor com tabela de preços editável e calibração com a duração real dos áudios.
4. Pacote de áudio pré-gravado com a voz escolhida e ensaio no local do evento.
5. Mais `.vrm` estilo anime para Rafa e Nina (seção 29).
6. Revisão de licenças e créditos antes do evento.

## O QUE NÃO FAZER

- Não copiar marca, nome, texto ou arte das referências.
- Não usar brilho neon, gradiente com tom violeta, cartões de vidro, partículas nem faíscas.
- Não gerar retrato, silhueta ou ilustração de personagem; só render do `.vrm`.
- Não construir pódio ou cenário em geometria 3D.
- Não deixar "Ouvir voz" chamar serviço pago.
- Não adivinhar qual arquivo é o Teo.
- Não apresentar o perfil dos personagens como dado real.
- Não reescrever o painel de configurações existente.
- Não usar travessão (—), ponto de status decorativo, selo de versão na tela do público ou faixa de local e hora.
- Não afirmar que algo funciona sem ter executado.
- Não entrar em laço de verificação sem fim.

## FORMATO DA RESPOSTA FINAL

1. Linha de base e resultado final (FPS, memória, tempo de carga com e sem cache).
2. Resultado por marco, com selo `TESTADO` ou `NÃO TESTADO`.
3. Paleta amostrada e tipografia escolhida, com o motivo.
4. Capturas de cada tela em retrato e paisagem.
5. Tabela de validação dos dois modelos (Luma e Teo).
6. Relatório do detector anti-slop e de acessibilidade.
7. Skills usadas, em que etapa, e as que faltaram.
8. O que eu preciso conferir manualmente (licença de cada `.vrm`, quem enviou o arquivo no Hub, condições de uso dos samples do VRoid).
9. Problemas conhecidos, sem suavizar.

Se alguma regra entrar em conflito com o que for possível fazer, pare e pergunte em vez de contornar.
