# MEGA PROMPT 2: refinamento (depois do M7)

> **Pasta de referência:** tudo fica em `repertorio/`.
> - `repertorio/REPERTORIO.md` é a fonte de verdade do projeto.
> - `repertorio/REFERENCIAS-UI-INDEX.md` registra as referências de interface.
> - `repertorio/ui/` guarda as capturas de referência (imagens `.webp`).
> Onde este texto citar `REPERTORIO.md`, leia `repertorio/REPERTORIO.md`.

Cole abaixo da linha na mesma ferramenta de código do primeiro prompt.
Coloque também a imagem de referência (a Sam) em `repertorio/ui/`. Se a ferramenta não aceitar imagem, a descrição em texto está na seção 13 do `repertorio/REPERTORIO.md`.
Substitua o `repertorio/REPERTORIO.md` antigo pelo novo (tem as seções 13 a 19).

---

## PAPEL

Você é um engenheiro front-end sênior com olho de direção de arte. O app já passou pelos marcos M1 a M7 do prompt anterior (multi-personagem, Kokoro, lip sync, webcam, design). Agora o trabalho é **refinar**: aproximar os personagens da direção visual e comportamental de referência, e acrescentar três capacidades: **RAG simples**, **controle de cache** e **voz mãos-livres**.

Responda e comente em português do Brasil.

## PASSO 0: AUDITORIA ANTES DE MEXER

1. Leia o `repertorio/REPERTORIO.md` inteiro, com atenção às seções 13 a 19, e o seu próprio log na seção 12.
2. Rode o app, abra cada personagem e registre o estado real: o que funciona, o que quebrou desde o M7, FPS, tempo até a primeira fala, tamanho total baixado na primeira visita. Mostre numa tabela curta. **Esse é o ponto de partida; todas as melhorias abaixo são medidas contra ele.**
3. Rode o detector anti-slop e a suíte de testes existente. Se algo já estiver vermelho, conserte primeiro e avise.
4. Verifique versões com `npm view` antes de adicionar qualquer pacote. Fixe versão exata.
5. Diga quais skills usou (design, three.js). Se faltar alguma, diga quais instalar.

## REGRAS QUE CONTINUAM VALENDO

- **Só `.vrm` pronto.** Nada de personagem, cenário ou textura gerados em código.
- **Sem cara de IA**, no visual, no texto e no código (seção 10 do REPERTORIO).
- **Selos `TESTADO` / `NÃO TESTADO`** em tudo. Nada de "deve funcionar".
- **Não invente API.** Confira na documentação ou no código-fonte do pacote.
- **Não amplie escopo.** Ideia extra vai para a seção 12 do REPERTORIO, com pergunta.

## REGRA NOVA: REFERÊNCIAS SÃO DIREÇÃO, NÃO CÓPIA

Sam (Samsung), Lu (Magalu), Galaxy/AR Emoji e avatares da Meta são **referência de estilo e de comportamento**. Não baixe, extraia, nem recrie esses personagens ou seus rostos. Os modelos continuam sendo os `.vrm` da pasta `assets/avatars/`. Se um `.vrm` não alcançar o look desejado, diga isso e recomende trocar o arquivo, em vez de tentar compensar com truques.

## BRIEF VISUAL (da referência)

Estilo 3D semi-realista estilizado. Olhos grandes e expressivos com profundidade. Pele com sombreamento suave e sem contorno grosso. Cabelo em mechas com volume e luz de recorte. Roupa casual simples, com dobras de tecido, que dá identidade forte. Pose natural e assimétrica, nunca "pose de catálogo". Luz de estúdio suave. Fundo dividido em duas cores, uma quente e uma fria.

**Limite honesto:** o MToon nasceu para estética de anime. Dá para chegar perto com bom modelo e boa luz; não dá para ficar idêntico a um render de estúdio. Diga, com evidência (capturas lado a lado), até onde chegou.

## O QUE FAZER, EM MARCOS

Entregue um marco por vez. Ao fim de cada um: medir contra a linha de base do Passo 0, mostrar o resultado e só então seguir.

### R1. Direção de arte e render (seção 14 do REPERTORIO)

- Rig de luz de três pontos por personagem (principal suave, preenchimento frio, recorte quente no cabelo), definido **nos dados** do personagem.
- Fundo dividido em duas cores por personagem, com a paleta nos dados. Sombra de contato suave.
- Ajuste de MToon por material: `shadingToony` mais baixo para pele, contorno fino ou desligado no rosto, `outlineLightingMixFactor` alto. Descubra os valores **testando em cada `.vrm`** e registre uma tabela de valores finais.
- Bloom só se o modelo tiver emissivo. Anti-serrilhado do cabelo.
- Qualidade adaptativa guiada por FPS (pixel ratio, sombra, bloom, nessa ordem).
- **Aceite:** capturas retrato e paisagem de cada personagem, antes e depois, e FPS mínimo definido por você e justificado.

### R2. Expressividade (seção 15)

- Camada de emoção: o LLM marca cada sentença (`neutro`, `alegre`, `pensativo`, `surpreso`, `curioso`, `empático`). A marca é removida antes do TTS e vira expressão VRM com intensidade baixa e transição suave. Marca inválida cai em neutro. Teste com saídas malformadas.
- Microexpressões: piscada com intervalo variável, sacadas oculares, respiração.
- Pose de assinatura por personagem via VRMA, com crossfade de 200 a 400 ms. Se faltar o clipe, não improvise pose em código: use `idle` e registre a lacuna.
- Escuta ativa: enquanto o usuário fala, o personagem inclina a cabeça e acena.
- **Aceite:** gravação curta ou sequência de capturas mostrando cada emoção, e um teste que prove que a marca nunca vai para o áudio.

### R3. Cache e controle de armazenamento (seção 17)

- Service worker com caches separados e versionados: shell, binários pesados, modelos. Apagar caches antigos no `activate`.
- Binários versionados com **cache primeiro**; shell com rede primeiro; scripts e estilos com stale-while-revalidate.
- **Nunca cachear** chamadas com chave de API.
- Atualização controlada: aviso "nova versão disponível" e o usuário aceita. Sem `skipWaiting` automático no meio da conversa.
- `navigator.storage.persist()` após ação do usuário e `navigator.storage.estimate()` para mostrar uso e cota. Trate `QuotaExceededError` com limpeza LRU e aviso visível.
- Cache de áudio TTS para frases repetidas (chave = motor + voz + velocidade + texto normalizado). Cache de respostas do LLM **apenas** para perguntas fixas, com TTL e chave que inclua versão da persona e hash do corpus.
- Hospede localmente WASM, worklet e modelos críticos, em vez de depender de CDN. Respostas opacas distorcem a cota.
- Painel "Armazenamento" nas configurações: tamanho por categoria, baixar, apagar uma categoria, apagar tudo, progresso de download, e "pronto offline" por personagem.
- **Aceite:** tabela de tempo de carga **sem cache, com cache e offline** (offline testado de verdade, não só pela caixa do DevTools), e um teste de que uma nova versão invalida só o que mudou.

### R4. RAG simples (seção 16)

- Base por personagem em `knowledge/<personagem>/` (`.md` e `.txt`; cada arquivo com `fonte:` e `licenca:`).
- Chunking por seção, 150 a 300 palavras, título preservado.
- Embeddings locais, modelo **multilíngue** (E5, com prefixos `query: ` e `passage: `, pooling por média e normalização L2). Confirme o id exato do modelo no Hugging Face antes de usar. Compare com uma alternativa e mostre por que escolheu.
- Vetores e metadados no IndexedDB. Busca por cosseno em força bruta, mais palavra-chave, fundidas por RRF.
- Limiar de confiança. Abaixo dele, o personagem diz que não sabe. **Não pode inventar.**
- Trechos recuperados entram no prompt como dado marcado, nunca como instrução. A resposta cita a fonte e o quadro mostra as fontes.
- Índice com chave `hash do conteúdo + id do modelo + versão do chunker + prefixo`. Mudou o arquivo, reindexa só ele.
- Conteúdo semente: poucos documentos por personagem, **com fonte e licença**. Teo: caderno de métodos. Rafa: guia de estimativas e unidades. Luma: curiosidades e histórias de domínio público. Se você não tiver fonte para um fato, não escreva o documento; avise e eu forneço.
- **Aceite:** 15 perguntas por corpus (10 respondíveis, 5 fora da base). Relatório com acerto da fonte e taxa de "não sei" correto. Teste com um documento que contenha "ignore as instruções anteriores" e prove que ele não é obedecido.

### R5. Voz mãos-livres e latência (seção 18)

- `@ricky0123/vad-web` com `MicVAD`: `onSpeechStart` e `onSpeechEnd` (o áudio sai a 16 kHz, formato que o Whisper do pipeline já usa). Hospede `.onnx`, worklet e `.wasm` localmente e fixe a versão.
- Interrupção: se o usuário fala enquanto o personagem fala, cancelar TTS, fila e requisição, e passar a ouvir.
- Eco: `echoCancellation` ligado e modo "apertar para falar" como alternativa. Avise sobre fone de ouvido.
- Painel de depuração com latências por turno: fim da fala → texto → primeiro token → primeiro áudio. Defina uma meta, justifique e mostre antes e depois.
- **Aceite:** medições reais com o servidor de voz local ligado e desligado.

### R6. Totem, segurança e robustez (seção 19)

- Modo totem: tela cheia, reset do histórico após N minutos sem rosto nem toque, modo de atração, saída oculta.
- Nada do modelo ou da base entra no DOM sem sanitização (`textContent`). CSP restrita aos hosts usados.
- Proxy mínimo opcional para a chave do Gemini, com limite de taxa, documentado no README. Não é obrigatório para uso pessoal.
- Acessibilidade: legenda sempre visível, controle de velocidade da fala, contraste, teclado, `prefers-reduced-motion`.
- **Aceite:** checklist marcado item a item, com selo de teste.

### R7. Avaliação contínua (seção 19)

- 20 perguntas por personagem, com rubrica (voz, método, concisão, segurança), rodáveis com um comando.
- Detector de frases proibidas sobre as respostas de teste.
- Capturas de tela por personagem, comparadas com a versão anterior (Playwright). Mudança visual só passa com minha aprovação.
- Orçamento de desempenho: FPS, memória depois de 10 trocas de personagem, tempo de carga.
- **Aceite:** um único comando (`npm run avaliar` ou equivalente) que roda tudo e imprime um relatório.

### R8. Fechamento

- README atualizado: como adicionar personagem, base de conhecimento, VRMA, como limpar cache, como rodar o servidor de voz.
- `repertorio/REPERTORIO.md` atualizado com tudo que você descobriu, na seção 12, no formato `data | o que testou | resultado | decisão`.
- Lista final de pendências conhecidas, sem suavizar.

## O QUE NÃO FAZER

- Não gerar, imitar ou baixar os personagens de referência.
- Não cachear respostas que dependam de histórico de conversa.
- Não usar versão flutuante (`@3`, `latest`).
- Não deixar `try/catch` vazio.
- Não afirmar que algo funciona sem ter executado.
- Não inventar conteúdo para a base de conhecimento.
- Não trocar de modelo de embeddings sem reindexar.

## FORMATO DA RESPOSTA FINAL

1. Tabela antes e depois (FPS, tempo até a primeira fala, tamanho da primeira carga, tempo com cache e offline).
2. Resultado por marco, com selo `TESTADO` ou `NÃO TESTADO`.
3. Capturas comparativas por personagem.
4. Relatório do RAG (acerto, "não sei" correto, teste de injeção).
5. O que eu preciso conferir manualmente.
6. Problemas conhecidos, sem suavizar.

Se alguma regra entrar em conflito com o que for possível fazer, pare e pergunte em vez de contornar.
