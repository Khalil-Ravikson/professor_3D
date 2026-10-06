# MEGA PROMPT 3: tema UEMA, ingestão de documentos, vozes e orçamento

> **Pasta de referência:** tudo fica em `repertorio/`.
> - `repertorio/REPERTORIO.md` é a fonte de verdade do projeto.
> - `repertorio/REFERENCIAS-UI-INDEX.md` registra as referências de interface.
> - `repertorio/ui/` guarda as capturas de referência (imagens `.webp`).
> Onde este texto citar `REPERTORIO.md`, leia `repertorio/REPERTORIO.md`.

Cole abaixo da linha na mesma ferramenta de código dos prompts anteriores.
Antes: substitua o `repertorio/REPERTORIO.md` pelo novo (seções 20 a 24 são desta rodada). Separe os documentos da UEMA que você tem (PDF, slides, texto) numa pasta `knowledge/_inbox/`.

---

## PAPEL

Você é um engenheiro full stack sênior, cuidadoso com custo e com conteúdo. O app já existe (multi-personagem, Kokoro, lip sync, webcam, cache, RAG básico). Agora vai ganhar um **tema**: a Universidade Estadual do Maranhão (UEMA). Também vai ganhar uma **ingestão de documentos**, um **laboratório de vozes** (Kokoro, ElevenLabs, NaturalReader), **controle de orçamento** (teto de R$ 200) e um **modo evento**.

Responda e comente em português do Brasil.

## PASSO 0: LEIA E AUDITE ANTES DE MEXER

1. Leia o `repertorio/REPERTORIO.md` inteiro, com atenção às seções 16, 17 e 20 a 24, e o seu log na seção 12.
2. **Leia o painel de configurações que já existe** (tokens, prompt e o que mais o dono acrescentou). Liste cada configuração, onde é guardada e como é usada. **Estenda esse painel. Não reescreva e não duplique.** Se algo ali conflitar com este prompt, pare e pergunte.
3. Rode o app e as avaliações existentes. Registre a linha de base: tempo até a primeira fala, custo estimado por resposta, tamanho da base atual. Se algo estiver quebrado, conserte primeiro e avise.
4. Confira os pacotes com `npm view` (ou `pip index versions`) antes de adicionar qualquer um. Fixe versão exata.
5. Verifique o id do modelo do Gemini no código. Hoje ele está fixo. Consulte a página oficial de descontinuações do Gemini e a lista de modelos da API **antes** de escolher qualquer id (seção 23 do REPERTORIO).

## REGRAS QUE CONTINUAM VALENDO

- Só `.vrm` pronto. Nada de personagem, cenário ou textura gerados em código.
- Sem cara de IA no visual, no texto e no código (seção 10 do REPERTORIO).
- Selos `TESTADO` / `NÃO TESTADO` em tudo.
- Não invente API nem preço. Confira na documentação do dia.
- Não amplie o escopo. Ideia extra vai para a seção 12 do REPERTORIO, com pergunta.

## REGRAS NOVAS DESTA RODADA

**N1. Nenhum fato sobre a UEMA sem fonte.** Cada pedaço da base tem `fonte`, `url` ou arquivo, `pagina` ou `slide`, `data_consulta` e `nivel`. Se você não tiver fonte, **não escreva o documento**: avise e eu forneço. Isso vale também para a versão infantil, que é sempre *derivada* de um texto aprovado.

**N2. Horários, contatos, datas de vestibular, valores e endereços só vêm de documento oficial atual que eu fornecer.** Sem ele, o personagem diz que não sabe e indica os canais oficiais da UEMA. Nunca chute.

**N3. Chaves pagas nunca ficam no navegador.** ElevenLabs e Gemini pagos passam por um **proxy local** que guarda a chave, conta o gasto e aplica tetos. A chave do LlamaParse só existe no script de ingestão, em variável de ambiente, fora do repositório.

**N4. O teto é R$ 200 no total.** Todo recurso pago tem contador, teto duro e plano B gratuito. Nenhuma chamada paga acontece sem passar pelo medidor.

**N5. Crianças.** Não perguntar nome nem escola. Não gravar áudio nem imagem. Registros só com contadores, sem texto de conversa por padrão.

## O QUE FAZER, EM MARCOS

Um marco por vez. Ao fim de cada um: rodar a verificação, mostrar o resultado e só então seguir.

### U1. Pipeline de ingestão (offline)

Crie `tools/ingest/` com um comando (`npm run ingest` ou equivalente) que converte arquivos da `knowledge/_inbox/` em Markdown revisável. Seção 21 do REPERTORIO.

- **Estratégia em camadas:** MarkItDown para PPTX, DOCX e PDFs digitais simples → Docling quando a estrutura sair quebrada → LlamaParse só para o que sobrar. Mostre o motivo da escolha para cada arquivo.
- **LlamaParse:** use a camada Cost-effective por padrão. **Antes de enviar**, faça uma estimativa (páginas × créditos por página) e peça confirmação. Confirme na documentação do dia os créditos por camada e se há plano gratuito. Só envie documentos que eu marque como públicos.
- Cuidado com a licença do PyMuPDF4LLM (AGPL-3.0). Se usar, avise e justifique.
- Saída: `.md` com cabeçalho (`fonte`, `url`, `data_consulta`, `nivel`, `licenca`, `origem_arquivo`, `pagina_ou_slide`). Slides: um slide por pedaço, com notas do orador marcadas.
- **Revisão humana obrigatória:** o arquivo só vai de `_inbox/` para `knowledge/uema/` depois de eu aprovar. Gere um relatório de qualidade por arquivo (tabelas detectadas, títulos, páginas sem texto) para eu revisar rápido.
- **Versão infantil:** comando separado que gera, de um texto **aprovado**, uma versão com linguagem simples, com `derivado_de:` apontando para a fonte. Ela só entra na base depois de nova aprovação.
- Manifest com hash por arquivo. Mudou o arquivo, reprocessa só ele e reindexa só ele.
- **Aceite:** ingestão de 3 arquivos reais meus (um PDF, um PPTX, um DOCX), com relatório, e teste de que o script **recusa** rodar sem a variável de ambiente da chave e **não** envia nada sem confirmação.

### U2. Corpus da UEMA

- Monte `knowledge/uema/` com **duas fontes**: (a) a semente verificada da seção 20 do REPERTORIO (linha do tempo e fatos institucionais), conferindo cada item no site oficial da UEMA e registrando a data da consulta; (b) os documentos que eu fornecer e aprovar.
- Resolva as divergências da seção 20 em vez de esconder. Se não resolver, marque o fato como `sem_numero_oficial` e não o afirme.
- Níveis de linguagem: `infantil`, `geral`, `tecnico`. O modo do personagem escolhe o nível. Recuperação filtra por nível, com queda para `geral` se não houver versão infantil.
- Comportamento fora do corpus: recusa gentil, uma frase, com sugestão de procurar os canais oficiais. Sem inventar.
- Revise o limiar de confiança do RAG com perguntas sobre a UEMA, dentro e fora da base.
- **Aceite:** 40 perguntas (25 respondíveis, 15 fora da base ou perigosas de inventar, como horário e valor). Relatório de acerto da fonte e de "não sei" correto. Zero invenção tolerada; mostre cada falha.

### U3. Atividades sobre a UEMA

Todas usam o RAG, citam a fonte e funcionam em modo infantil. Reaproveite o quadro e as emoções que já existem.

1. **Linha do tempo** (1972, 1975, 1979, 1981, 1987, 2016, hoje): o personagem narra cada marco, e o quadro mostra a data e a fonte.
2. **Quiz da UEMA:** perguntas geradas **da base**, com resposta e fonte. Se a base não sustentar a pergunta, ela não é gerada.
3. **Curso mistério:** três pistas tiradas de um documento de curso que eu forneci. Sem documento, a atividade fica desligada.
4. **Pergunte sobre a UEMA:** conversa livre limitada ao corpus.

- Cada personagem tem uma ligação com o tema (seção 20). Ajuste a persona de cada um com **dois exemplos reais** de fala, sem enchimento e sem abertura genérica.
- **Aceite:** capturas de cada atividade em retrato e paisagem; teste que prove que o quiz nunca gera pergunta sem fonte.

### U4. Provedores de voz e laboratório de vozes

- Estenda o adaptador de TTS com: `kokoro-server` (existente), `elevenlabs` (via proxy local) e `arquivo-importado` (MP3 pré-gravado, por exemplo do NaturalReader).
- **NaturalReader:** não assuma API. Verifique a documentação pública e, se não houver, trate como estúdio de pré-gravação: eu exporto os MP3 e você os importa, indexados por hash de texto e voz.
- **Léxico de pronúncia** por motor (Maranhão, UEMA, UEMASUL, FESM, Imperatriz, Caxias, *Scientia ad Vitam*, datas, números). Confira como cada motor aceita ajuste de pronúncia antes de depender disso.
- **Laboratório de vozes** (página própria, só para o operador): 12 a 15 frases fixas, cada uma gerada em cada voz, em ordem aleatória e sem rótulo, com nota de 1 a 5 em naturalidade, clareza e pronúncia dos nomes. Meça também tempo até o primeiro áudio, estabilidade (duas gerações da mesma frase) e custo por 1.000 caracteres. Salve em JSON e gere um relatório.
- O teste com ElevenLabs deve caber no plano gratuito. Registre que o plano gratuito não dá licença comercial e que o uso no evento exige plano pago ou confirmação.
- **Decisão por dados:** ao fim, recomende o papel de cada voz (ao vivo, pré-gravada, desligada) com base no relatório. Não decida pelo gosto.
- **Aceite:** relatório do laboratório com as notas, as medições e a recomendação.

### U5. Orçamento e controle de gasto

Siga a seção 23 do REPERTORIO. A conta de referência está lá; **recalcule com os números medidos no app**, não com os estimados.

- **Proxy local** (Node, poucas linhas) com as chaves em variável de ambiente. O navegador só fala com o proxy.
- **Medidor de custo:** caracteres de TTS por provedor e tokens de LLM por sessão e por dia, com tabela de preços **editável** (inclusive câmbio). Aviso aos 80%. Ao bater o teto, troca automática para o plano B gratuito (Kokoro e respostas prontas), com aviso ao operador.
- **Modelo do Gemini configurável**, com cadeia: principal → modelo mais barato → resposta pronta do RAG. Nada de id fixo no código. Registre qual id você escolheu e por quê, com a data da consulta.
- Comando `npm run orcamento`: recebe estações, sessões por dia, turnos por sessão e caracteres por resposta, e imprime o gasto previsto por plano (A, B e C da seção 23), com margem de 15%.
- **Aceite:** teste que simula o teto estourando (gasto falso) e prova a troca para o plano B sem erro visível; tabela comparando o orçamento previsto com o gasto medido em 30 turnos reais.

### U6. Modo evento

Seção 24 do REPERTORIO. Estenda o painel do operador existente.

- Dois modos: **demonstração guiada** (botões, respostas e áudios pré-gravados, funciona offline) e **conversa livre** (LLM + RAG + voz, limitada ao corpus).
- Política de sessão: limite de turnos e de tempo, limpeza do histórico ao fim ou por inatividade, fila visível.
- **Pacote de áudio pré-gravado:** comando que gera, antes do evento, os áudios das falas fixas (abertura, linha do tempo, respostas do quiz) com a voz escolhida em U4, e os coloca no cache por hash de texto e voz.
- **Escada de falhas** (cada degrau avisa o operador e continua): voz premium cai ou estoura o teto → Kokoro; Gemini falha, estoura cota ou fica lento → resposta pronta do RAG com a fonte, mais Kokoro; internet cai → modo guiado com áudios pré-gravados; Kokoro cai → voz do navegador, com aviso.
- Botão de emergência: "modo econômico" (só Kokoro e respostas prontas).
- **Aceite:** teste de cada degrau da escada, derrubando o recurso de verdade (desligar rede, parar o servidor de voz, chave inválida), com selo `TESTADO`.

### U7. Ensaio e avaliação

- Roteiro de ensaio de 30 minutos para o local do evento, com a rede do evento: lista de verificação antes de abrir, durante e ao fechar.
- Simulação de 30 sessões seguidas em cada modo, medindo latência, memória, gasto e erros.
- Avaliação das 40 perguntas da U2 e das atividades da U3 em um comando só (`npm run avaliar`), com relatório.
- Detector de frases proibidas sobre as respostas de teste (seção 10 do REPERTORIO).
- **Aceite:** relatório único com: custo medido por resposta, projeção de gasto para o plano escolhido, taxa de "não sei" correto, latência até a primeira fala e lista de problemas abertos.

### U8. Fechamento

- README: como adicionar documentos, rodar a ingestão, aprovar uma versão infantil, subir o proxy e as chaves, rodar o laboratório de vozes, gerar o pacote pré-gravado e usar o painel do operador.
- `repertorio/REPERTORIO.md` atualizado na seção 12, no formato `data | o que testou | resultado | decisão`, incluindo preços e limites que você **conferiu no dia**.
- Lista final de pendências conhecidas, sem suavizar.

## O QUE NÃO FAZER

- Não inventar fato, número, data, horário ou contato da UEMA.
- Não pôr chave paga no navegador, no repositório ou em log.
- Não enviar documento a serviço de nuvem sem minha confirmação explícita para aquele arquivo.
- Não gerar áudio pago fora do medidor de custo.
- Não fixar id de modelo no código.
- Não reescrever o painel de configurações existente.
- Não decidir a voz por gosto; decidir pelo laboratório.
- Não afirmar que algo funciona sem ter executado.

## FORMATO DA RESPOSTA FINAL

1. Linha de base e resultado final (tempo até a primeira fala, custo por resposta, tamanho da base).
2. Resultado por marco, com selo `TESTADO` ou `NÃO TESTADO`.
3. Relatório da ingestão (arquivos, método usado em cada, créditos gastos).
4. Relatório do RAG da UEMA (acerto da fonte, "não sei" correto, falhas).
5. Relatório do laboratório de vozes e a recomendação por dados.
6. Tabela de orçamento: previsto × medido, por plano, com margem.
7. O que eu preciso conferir manualmente (termos de uso do plano gratuito, política de imagem e voz de menores com a UEMA, câmbio e IOF do cartão).
8. Problemas conhecidos, sem suavizar.

Se alguma regra entrar em conflito com o que for possível fazer, pare e pergunte em vez de contornar.
