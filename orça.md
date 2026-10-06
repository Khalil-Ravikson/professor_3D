# ORÇAMENTO TÉCNICO E FINANCEIRO

## Projeto Avatar 3D com Inteligência Artificial — Criança Engenharia UEMA

Documento de planejamento · Outubro de 2026 · Valores em reais (BRL)

Investimento máximo previsto

Dentro do orçamento

# R$ 170,00

Limite financeiro estabelecido: R$ 200,00 · Margem disponível: R$ 30,00.

# 350

Crianças estimadas

# 50%

Participação livre prevista

# 2

Perguntas livres por participante

# 180

Caracteres máximos por resposta

## 1. Apresentação do projeto

O projeto consiste no desenvolvimento de um avatar tridimensional interativo, equipado com inteligência artificial generativa, síntese de voz e animação facial, para utilização durante o evento Criança Engenharia, promovido pela Universidade Estadual do Maranhão (UEMA).

A proposta é proporcionar às crianças uma experiência educativa e interativa, na qual um personagem virtual possa apresentar informações, responder perguntas e conduzir pequenas atividades relacionadas à engenharia, tecnologia, ciência e inovação.

A solução utilizará três componentes tecnológicos principais:

* LLM: Google Gemini, responsável por interpretar perguntas e elaborar respostas.

* TTS: ElevenLabs, responsável pela geração de voz natural, com Kokoro como alternativa local.

* Avatar 3D: modelo tridimensional com animação facial e reprodução sincronizada de áudio.

O projeto será operado em um ambiente controlado por salas e instituições. Portanto, não será disponibilizado como uma plataforma de acesso irrestrito. Essa característica permite estimar o público, limitar a duração das sessões e controlar o consumo dos serviços de inteligência artificial.

### Objetivo financeiro

Desenvolver uma experiência com boa qualidade de voz e interação, mantendo o investimento total entre R$ 100 e R$ 200, priorizando tecnologias gratuitas ou de baixo custo sempre que possível.

## 2. Dimensionamento do público e modelo de utilização

O evento receberá aproximadamente 7.000 crianças, mas somente uma parcela será direcionada à atividade do avatar.

Para o orçamento, estabelecemos um público específico de 350 crianças, equivalente a aproximadamente 5% do público geral.

Público total do evento 7.000

Público estimado do avatar

## 350

Participação estimada do avatar: 5% do público geral.

### Modelo de atendimento

A experiência será híbrida, combinando interações previamente programadas com respostas geradas dinamicamente.

| Tipo de interação    | Funcionamento                  | Custo de IA               |
| -------------------- | ------------------------------ | ------------------------- |
| Apresentação         | Áudio previamente gerado       | Sem consumo por repetição |
| Perguntas frequentes | Respostas armazenadas em cache | Sem novo TTS              |
| Perguntas livres     | Gemini gera resposta           | Tokens + TTS              |
| Encerramento         | Áudio previamente gerado       | Sem consumo por repetição |

Essa estrutura é importante porque o custo de síntese de voz está diretamente relacionado à quantidade de caracteres processados, e não simplesmente ao número de crianças presentes.

Premissa operacional adotada:

* 350 crianças atendidas.

* Aproximadamente 50% utilizarão perguntas livres.

* Cada participante fará até duas perguntas livres.

* Cada resposta terá até 180 caracteres.

* As demais interações utilizarão falas previamente geradas.

O cenário-base representa aproximadamente 175 participantes utilizando perguntas livres, sem pressupor que todos necessariamente consumirão o limite disponível.

## 3. Arquitetura tecnológica

A arquitetura foi pensada para evitar dependência exclusiva de serviços pagos e permitir a substituição de fornecedores de voz sem necessidade de modificar toda a aplicação.

## Arquitetura proposta

Interface de interação

Tela touch / microfone / seleção de perguntas

Gerenciador de sessões

Controle de instituição, sala, limites e histórico anônimo

Google Gemini

Interpretação da pergunta e geração de resposta

TTS Router

Cache, controle de créditos e seleção de provedor

ElevenLabs

Principal

Voz natural

Kokoro

Alternativo

Geração local

Avatar 3D

Reprodução de áudio, animação facial e sincronização labial

### 3.1. Google Gemini — inteligência artificial

O Gemini será responsável pela inteligência conversacional do personagem.

Suas atribuições serão:

* Interpretar as perguntas das crianças.

* Elaborar respostas curtas e educativas.

* Manter o contexto da interação durante a sessão.

* Respeitar as restrições temáticas definidas para o personagem.

* Evitar respostas inadequadas à faixa etária.

A recomendação é utilizar um modelo econômico da família Gemini Flash, com instruções de sistema que limitem a extensão das respostas.

Uma configuração importante é estabelecer um limite de saída de aproximadamente 180 caracteres para as respostas destinadas à voz.

Isso reduz o consumo de tokens, diminui o tempo de geração e evita que o avatar apresente explicações excessivamente longas.

### 3.2. ElevenLabs — síntese de voz principal

O ElevenLabs será utilizado para gerar a voz principal do personagem.

Sua função será transformar as respostas textuais do Gemini em arquivos de áudio, que posteriormente serão reproduzidos pelo avatar.

O serviço será utilizado principalmente para:

* Apresentação do personagem.

* Frases institucionais.

* Perguntas frequentes.

* Respostas dinâmicas selecionadas.

A contratação considerada é o plano Creator, com aproximadamente 121 mil créditos mensais no preço regular utilizado nesta estimativa.

### 3.3. Kokoro — contingência local

O Kokoro continuará disponível como mecanismo alternativo de síntese de voz.

A vantagem é que ele não exige pagamento de créditos por caractere quando executado localmente.

Sua utilização será importante em três situações:

1. Quando os créditos do ElevenLabs atingirem o limite operacional.

2. Quando ocorrer indisponibilidade da API.

3. Quando for necessário gerar áudio sem depender de conexão externa.

O Kokoro poderá ter diferenças de naturalidade e expressividade em relação à voz contratada, mas garante uma alternativa operacional.

### 3.4. Avatar 3D — apresentação visual

O modelo tridimensional já faz parte do desenvolvimento do projeto.

Não será necessário adquirir uma nova plataforma de avatar ou contratar um serviço de animação por requisição.

O trabalho será concentrado em:

* Reprodução dos arquivos de áudio.

* Sincronização labial.

* Estados de animação.

* Expressões faciais.

* Movimentos durante a fala.

* Estados de espera e encerramento.

Os custos de desenvolvimento, equipamento e eventuais licenças do modelo 3D não estão incluídos no orçamento de consumo de APIs apresentado neste documento.


## 4. Dimensionamento de consumo

Esta é a parte mais importante do orçamento, pois determina a quantidade de créditos que será necessária.

### 4.1. Cálculo das interações dinâmicas

Considerando 350 crianças e uma taxa de participação de 50% nas perguntas livres:

350×0,50=175 crianc¸as350 \times 0{,}50 = 175 \text{ crianças}350×0,50=175 crianc¸as

Cada uma poderá realizar até duas perguntas:

175×2=350 respostas175 \times 2 = 350 \text{ respostas}175×2=350 respostas

Considerando o limite de 180 caracteres:

350×180=63.000 caracteres350 \times 180 = 63.000 \text{ caracteres}350×180=63.000 caracteres

Além das respostas dinâmicas, reservamos aproximadamente 3.000 caracteres para a geração inicial das falas fixas.

Consumo total projetado

# 66.000

Caracteres estimados, incluindo a primeira geração dos áudios fixos.

Respostas dinâmicas

63.000

Falas fixas

3.000

Total

66.000

### 4.2. Margem de segurança

Não devemos contratar serviços considerando somente o consumo matemático esperado.

Recomendo estabelecer uma margem operacional de 20%:

66.000×1,20=79.20066.000 \times 1{,}20 = 79.20066.000×1,20=79.200

Portanto, a capacidade de planejamento será de aproximadamente 79.200 créditos equivalentes, assumindo um crédito por caractere no modelo de voz escolhido.

Essa margem absorve variações no tamanho das respostas, repetições e ajustes durante os testes. Não cobre necessariamente multiplicadores específicos de modelos.

### 4.3. Comparação com a capacidade do ElevenLabs

Share

Chart options

Capacidade de voz versus consumo

Créditos aproximados, considerando um crédito por caractere.



O plano Creator oferece capacidade suficiente para o cenário-base e a margem planejada.

Isso significa que, com a hipótese de 50% de participação livre, não precisamos transferir obrigatoriamente parte das respostas para o Kokoro.

O Kokoro continua sendo necessário como contingência, mas não como fornecedor principal de uma parcela previsível do consumo.

Importante: os 121 mil créditos são uma capacidade nominal. Antes da contratação, precisamos confirmar o modelo exato de voz e sua regra de cobrança, pois o consumo pode variar entre modelos.


Capacidade de voz versus consumo

Créditos aproximados, considerando um crédito por caractere.

item	credits
Consumo base	66,000
Com margem	79,200
Creator	121,000

## 5. Orçamento financeiro detalhado

O orçamento será dividido entre contratação de serviços, consumo de APIs e reserva operacional.

A premissa cambial utilizada será:

US$1,00=R$5,50US\$ 1,00 = R\$ 5,50US$1,00=R$5,50

Esse valor é uma taxa de planejamento, não uma cotação comercial confirmada. A cobrança efetiva dependerá da cotação do cartão, impostos e encargos aplicáveis.

### 5.1. ElevenLabs Creator

![Digital & AI Summit Lima 2026 | NTT DATA](https://images.openai.com/static-rsc-4/6epcgt88uKnhu7PgBz01Fz6qSHg5XKIolKWrBny9SP5yYe_fJLlwpqOU7bI-bDaGxkG2oT9X8yxfMAkPFgj337tCbaTgATHklJ-iELwMw-BZ4ZJQGRv8ZCKnuD7rI5Rj8q2_dkho7We2vxwvE2Jv4ppr3JfOhLeISAXrxwk22wc?purpose=inline)

ElevenLabs

Plano Creator · Síntese de voz via API

Principal

| Característica      | Especificação                |
| ------------------- | ---------------------------- |
| Plano               | Creator                      |
| Preço regular       | US$ 22/mês                   |
| Créditos mensais    | 121.000                      |
| Licença comercial   | Incluída                     |
| Uso previsto        | 66.000 créditos equivalentes |
| Capacidade restante | 55.000 créditos              |

Conversão:

22×5,50=R$12122 \times 5{,}50 = R\$ 12122×5,50=R$121

O plano Creator é a contratação de referência porque permite trabalhar com uma voz de maior naturalidade sem depender de uma distribuição obrigatória de respostas entre diferentes fornecedores.

A página oficial também apresenta uma promoção de US$ 11 no primeiro mês, mas não utilizarei esse desconto como premissa permanente.

![](https://www.google.com/s2/favicons?domain=https://elevenlabs.io\&sz=32)

ElevenLabs

Justificativa da contratação: o plano Creator permite manter a qualidade da voz durante as interações personalizadas e oferece uma margem nominal de aproximadamente 45% sobre o consumo projetado de 79.200 créditos com segurança.

### 5.2. Google Gemini API

![Gemini – Google’s AI Assistant for Smart Conversations & Productivity – Daidu.ai](https://images.openai.com/static-rsc-4/ptJvxAnbpHSz9oKwhiZCWU9MTvmPl997rGrZd4wqTgvg18xJPt8X3ASwCANnmkTN4cvnMJqTW5csYg-Wx_SyU_pL6waVf_YLfxdwlsLklzd2H22udrktQ6oVGaeLOvjKRl8y4lJCZGtYV2I-4GwcwBjAGawfKX-wZYbv6TzRORU?purpose=inline)

Google Gemini

Modelo econômico para respostas dinâmicas

Consumo variável

O Gemini será utilizado somente quando a interação exigir geração de uma resposta nova.

Para reduzir custos, a recomendação é utilizar um modelo Flash-Lite e manter as respostas limitadas.

A tabela oficial de preços do Gemini 2.5 Flash-Lite apresenta:

| Tipo de token    | Preço por milhão |
| ---------------- | ---------------- |
| Entrada de texto | US$ 0,10         |
| Saída de texto   | US$ 0,40         |

Há modalidade gratuita sujeita às condições e limites do serviço.

![](https://www.google.com/s2/favicons?domain=https://ai.google.dev\&sz=32)

Google AI for Developers

+1

Para dimensionar o consumo, podemos utilizar uma hipótese de 350 chamadas ao modelo, com:

* 600 tokens de entrada por chamada, incluindo instruções e contexto.

* 100 tokens de saída por chamada.

Isso produziria:

Tentrada=350×600=210.000T_{entrada}=350 \times 600=210.000Tentrada=350×600=210.000

Tsaida=350×100=35.000T_{saida}=350 \times 100=35.000Tsaida=350×100=35.000

Estimativa de custo:

C=210.0001.000.000×0,10+35.0001.000.000×0,40C = \frac{210.000}{1.000.000}\times 0{,}10 +\frac{35.000}{1.000.000}\times 0{,}40C=1.000.000210.000×0,10+1.000.00035.000×0,40

C=US$0,035C = US\$ 0,035C=US$0,035

Convertendo:

C≈R$0,19C \approx R\$ 0,19C≈R$0,19

Exemplo matemático baseado nos preços publicados para o modelo indicado. Não é uma medição real nem inclui STT, ferramentas adicionais ou chamadas extras.

Portanto, os R$ 10 reservados para o Gemini são uma provisão financeira bastante conservadora, não uma previsão de gasto.

### 5.3. Kokoro TTS

![Kokoro TTS Review: Hands-On With the 82M Open-Source Voice Model | VisionStory](https://images.openai.com/static-rsc-4/cXCEWVst7IXAVGhMEyzo8qaKh3xr-v98qbfqRU9torpADUFmpYY3zXZx2TlSxD-kC9WqLZi9LgC2VzOZvwsaiolWnuVA61qvm7sMF0ACObZ9IoU_bh8hg8X10Pj63r8aGIwbNKqBkTX2I3Txz5eGEsaNgEv-qk9zKSWoOacPCqc?purpose=inline)

Kokoro TTS

Síntese local e contingência

R$ 0

O Kokoro será mantido na infraestrutura local, sem pagamento de créditos externos.

Sua responsabilidade será garantir a continuidade da experiência caso:

* A API do ElevenLabs fique indisponível.

* O limite operacional de créditos seja atingido.

* Seja necessário gerar áudios adicionais.

* A conexão com a internet apresente instabilidade.

Não haverá contratação adicional de servidor para essa função, considerando a utilização do equipamento já disponível.

O custo financeiro direto de API será zero, embora exista consumo de processamento, memória, energia e tempo de execução.

### 5.4. Cache e armazenamento

O armazenamento dos áudios será realizado localmente.

A proposta é manter uma estrutura de cache que identifique textos já sintetizados e permita recuperar os respectivos arquivos sem uma nova requisição.

Exemplo:

```
avatar/
├── audio/
│   ├── fixed/
│   │   ├── presentation.wav
│   │   ├── welcome.wav
│   │   └── goodbye.wav
│   │
│   ├── cache/
│   │   ├── hash_001.wav
│   │   ├── hash_002.wav
│   │   └── hash_003.wav
│   │
│   └── fallback/
│       └── kokoro/
│
└── metadata/
    └── audio_cache.json
```

O funcionamento será simples:

1. O Gemini produz a resposta.

2. O sistema normaliza o texto.

3. Calcula um hash do conteúdo.

4. Verifica se o áudio já existe.

5. Se existir, recupera o arquivo.

6. Caso contrário, solicita a geração ao TTS.

7. Armazena o áudio para reutilização futura.

Essa estratégia reduz chamadas repetidas e melhora a velocidade de resposta.

## 6. Consolidação financeira

Abaixo está o orçamento consolidado com os valores reservados.

| Item                       | Natureza                 | Valor     |
| -------------------------- | ------------------------ | --------- |
| ElevenLabs Creator         | Assinatura mensal        | R$ 121,00 |
| Gemini API                 | Consumo variável         | R$ 10,00  |
| Kokoro                     | Software local           | R$ 0,00   |
| Cache e armazenamento      | Infraestrutura existente | R$ 0,00   |
| Reserva cambial e encargos | Provisão                 | R$ 39,00  |
| Total de planejamento      |                          | R$ 170,00 |

Share

Chart options

Distribuição do orçamento

Valores reservados, não necessariamente valores efetivamente consumidos.

ElevenLabs

Gemini

Reserva

### Análise da reserva financeira

A reserva de R$ 39 representa aproximadamente 22,9% do orçamento planejado.

Ela foi separada para absorver variações de câmbio, encargos de pagamento internacional e pequenas despesas não previstas.

É importante distinguir:

* Custo contratado: valor efetivamente pago ao fornecedor.

* Consumo de API: valor variável conforme a utilização.

* Reserva: dinheiro separado para eventuais diferenças.

Portanto, os R$ 170 representam o orçamento reservado, e não uma obrigação de gastar integralmente esse valor.

A margem de R$ 30 permanece disponível para não ultrapassar o limite de R$ 200.


Distribuição do orçamento

Valores reservados, não necessariamente valores efetivamente consumidos.

item	valor
ElevenLabs	121
Gemini	10
Reserva	39

## 7. Alternativas tecnológicas e comparação de fornecedores

Além da arquitetura proposta, existem outras possibilidades que podem ser avaliadas.

### Comparativo de TTS

| Critério              | ElevenLabs | Kokoro                              | NaturalReader                |
| --------------------- | ---------- | ----------------------------------- | ---------------------------- |
| Voz natural           | Alta       | Boa, depende da voz                 | Varia conforme modelo        |
| Execução local        | Não        | Sim                                 | Não, no fluxo comercial web  |
| API                   | Sim        | Pode ser disponibilizada localmente | Não presumir disponibilidade |
| Cobrança por uso      | Créditos   | Sem créditos externos               | Conforme plano e modelo      |
| Fallback offline      | Não        | Sim                                 | Não                          |
| Integração com avatar | API        | Integração própria                  | Depende do acesso disponível |

### Alternativa A — ElevenLabs + Kokoro

Arquitetura orçada

Essa alternativa mantém uma voz comercial principal e um mecanismo local de contingência.

Vantagens:

* Qualidade de voz consistente no fluxo principal.

* Integração por API.

* Possibilidade de controlar créditos.

* Continuidade com Kokoro quando necessário.

Desvantagem:

* Dependência da internet para utilizar o ElevenLabs.

* Necessidade de controlar o consumo da assinatura.

### Alternativa B — NaturalReader + Gemini

O NaturalReader também pode ser avaliado.

Seu plano comercial pode ser interessante para geração de áudios institucionais e falas previamente preparadas.

Entretanto, há uma diferença importante entre contratar uma ferramenta para gerar arquivos de áudio e contratar uma API que possa ser chamada automaticamente pela aplicação.

Para o projeto, precisamos confirmar:

* Disponibilidade de API comercial.

* Possibilidade de geração automatizada.

* Permissão de reprodução dos áudios no evento.

* Limites de utilização e créditos.

* Compatibilidade com o fluxo de reprodução do avatar.

Não recomendo substituir o ElevenLabs por NaturalReader sem validar esses requisitos.

### Alternativa C — Gemini + Kokoro

Menor dependência comercial

Outra possibilidade é manter o Gemini como inteligência e utilizar exclusivamente o Kokoro para gerar todas as vozes.

Nesse caso, o orçamento de TTS seria zero.

Vantagens:

* Sem assinatura de voz.

* Sem limite comercial de créditos por caractere.

* Maior controle sobre o processamento.

* Possibilidade de funcionamento local.

Desvantagens:

* Dependência do desempenho do equipamento.

* Necessidade de testar a naturalidade da voz.

* Possíveis diferenças de qualidade e expressividade.

Essa alternativa é interessante caso o orçamento precise ser reduzido ainda mais.

## 8. Controle de orçamento e gerenciamento de sessões

Considerando o controle de acesso por sala e instituição, recomendo desenvolver um pequeno módulo de gerenciamento operacional.

Não é necessário construir um sistema administrativo complexo. Um dashboard simples será suficiente.

### Indicadores que devem ser monitorados

| Indicador               | Finalidade                      |
| ----------------------- | ------------------------------- |
| Total de sessões        | Contabilizar crianças atendidas |
| Instituição             | Identificar origem do grupo     |
| Sala                    | Organizar atendimento           |
| Perguntas livres        | Medir utilização da IA          |
| Caracteres sintetizados | Monitorar ElevenLabs            |
| Tokens consumidos       | Monitorar Gemini                |
| Áudios em cache         | Medir economia                  |
| Uso do Kokoro           | Acompanhar contingências        |

### Limites recomendados

| Controle                          | Configuração     |
| --------------------------------- | ---------------- |
| Crianças planejadas               | 350              |
| Participação livre                | 50%              |
| Perguntas livres por participante | 2                |
| Caracteres por resposta           | 180              |
| Consumo projetado                 | 66.000           |
| Consumo com margem de 20%         | 79.200           |
| Limite operacional sugerido       | 100.000 créditos |

O limite operacional de 100 mil créditos deixa uma margem adicional antes de atingir os 121 mil créditos nominais do plano Creator.

### Exemplo de lógica de controle

Python

Run

```
MAX_SESSIONS = 350
MAX_FREE_QUESTIONS = 2
MAX_RESPONSE_CHARS = 180

MAX_TTS_CREDITS = 100_000

async def process_interaction(session, text):

    if session.questions_used >= MAX_FREE_QUESTIONS:
        return await play_predefined_audio("goodbye")

    response = await gemini.generate(
        text=text,
        max_output_chars=MAX_RESPONSE_CHARS
    )

    if budget.can_use_elevenlabs(len(response)):
        audio = await elevenlabs.generate(response)
    else:
        audio = await kokoro.generate(response)

    session.questions_used += 1

    return audio
```

O código representa a lógica de referência. Na implementação real, é importante contabilizar os créditos efetivamente utilizados, tratar falhas de geração e garantir que duas requisições simultâneas não ultrapassem o limite.

Recomendação adicional: a quantidade de sessões deve ser controlada independentemente da quantidade de perguntas. Assim, uma instituição não poderá consumir todo o orçamento por meio de sessões excessivamente longas.

## 9. Riscos técnicos e medidas de prevenção

| Risco                      | Impacto                        | Medida preventiva                  |
| -------------------------- | ------------------------------ | ---------------------------------- |
| Falta de internet          | API indisponível               | Kokoro local e áudios pré-gerados  |
| Esgotamento de créditos    | Interrupção da voz principal   | Limite operacional de 100 mil      |
| Respostas muito longas     | Maior consumo e latência       | Limite de caracteres               |
| Repetição de perguntas     | Desperdício de créditos        | Cache de áudio                     |
| Falha no Gemini            | Ausência de resposta dinâmica  | Perguntas e respostas predefinidas |
| Demora na geração de voz   | Filas de atendimento           | Pré-carregamento de áudios         |
| Problemas de sincronização | Experiência visual prejudicada | Testes de lip sync                 |

### Atenção especial à entrada por microfone

O orçamento apresentado considera os custos de geração de texto e voz, mas não inclui reconhecimento de fala (STT).

Se a criança fizer perguntas falando, será necessário adicionar um componente que converta áudio em texto.

Nesse caso, podemos avaliar:

* Whisper local.

* Speech-to-Text de algum provedor.

* Serviço de transcrição do ElevenLabs, conforme condições de créditos e plano.

Se a entrada for por tela touch ou teclado, não será necessário adicionar STT.

Essa definição deve ser fechada antes da contratação.

### Cuidados com o público infantil

Como o projeto será utilizado por crianças, também recomendo:

* Não solicitar informações pessoais.

* Não armazenar gravações de voz sem necessidade.

* Limitar as respostas a assuntos educativos.

* Implementar filtros de conteúdo inadequado.

* Utilizar sessões temporárias e anônimas.

* Encerrar automaticamente as sessões após o atendimento.

## 10. Plano de execução e validação

Antes do evento, o projeto deverá passar por uma etapa de testes para validar o consumo real.

| Etapa | Atividade               | Resultado esperado                  |
| ----- | ----------------------- | ----------------------------------- |
| 1     | Configurar Gemini       | Respostas curtas e controladas      |
| 2     | Integrar ElevenLabs     | Geração de voz via API              |
| 3     | Integrar Kokoro         | Fallback operacional                |
| 4     | Criar cache             | Reutilização de áudios              |
| 5     | Integrar avatar 3D      | Reprodução e animação sincronizadas |
| 6     | Testar 20–30 interações | Medição de consumo real             |
| 7     | Simular falhas          | Validar contingência                |
| 8     | Executar teste de carga | Verificar estabilidade              |

### Teste de consumo

Eu faria um teste com 20 a 30 interações reais, utilizando diferentes perguntas.

Exemplo:

| Teste | Pergunta                                 | Caracteres |
| ----- | ---------------------------------------- | ---------- |
| 01    | O que é engenharia?                      | 120        |
| 02    | Como funciona um robô?                   | 150        |
| 03    | Por que precisamos de eletricidade?      | 170        |
| 04    | Como os computadores pensam?             | 180        |
| 05    | Como funciona a inteligência artificial? | 180        |

Após os testes, calcularia:

Cmeˊdio=Total de creˊditos utilizadosNuˊmero de respostasC_{médio} = \frac{\text{Total de créditos utilizados}}{\text{Número de respostas}}Cmeˊdio=Nuˊmero de respostasTotal de creˊditos utilizados

Com esse resultado, poderemos substituir a hipótese de 180 caracteres por uma medição real.

Também é necessário testar a latência de ponta a ponta, desde a pergunta até o início da fala do avatar.

## 11. Resumo executivo do orçamento

## Criança Engenharia — UEMA

Resumo da proposta financeira e tecnológica

# R$ 170,00

Investimento máximo planejado, considerando o preço regular do Creator.

Composição

| Serviço                  | Investimento |
| ------------------------ | ------------ |
| ElevenLabs Creator       | R$ 121       |
| Gemini API               | R$ 10        |
| Kokoro                   | R$ 0         |
| Infraestrutura existente | R$ 0         |
| Reserva financeira       | R$ 39        |
| Total                    | R$ 170       |

Capacidade operacional

# 350

Crianças estimadas

# 66 mil

Caracteres projetados

# 79,2 mil

Com margem de segurança

# 100 mil

Limite operacional de créditos

Arquitetura selecionada

* Gemini Flash-Lite para respostas dinâmicas.

* ElevenLabs Creator para voz principal.

* Kokoro para contingência.

* Cache local para reutilização de áudios.

* Controle de sessões por instituição e sala.

## 12. Conclusão e recomendação

O dimensionamento proposto permite atender a uma estimativa de 350 crianças com uma arquitetura híbrida, na qual somente as interações que exigem personalização utilizam recursos pagos de inteligência artificial.

A reutilização de áudios reduz a necessidade de novas sínteses, enquanto o controle de sessões limita o consumo de serviços externos. O uso combinado de ElevenLabs e Kokoro também reduz a dependência de um único fornecedor de voz.

O investimento de R$ 170,00 mantém uma margem de R$ 30,00 em relação ao teto estabelecido de R$ 200,00.

A contratação do ElevenLabs Creator é uma premissa conservadora de capacidade, não uma exigência de consumo integral. O valor efetivamente utilizado dependerá da quantidade de crianças que fizerem perguntas livres e do tamanho das respostas.

Minha recomendação final: manter Gemini + ElevenLabs + Kokoro, realizar os testes com 20 a 30 interações antes da contratação e só então confirmar a assinatura. Não recomendo migrar para NaturalReader neste momento sem comprovar a integração comercial por API.

### Referências oficiais para contratação e conferência

* ElevenLabs — Planos e preços oficiais

  .

* Google — Preços da Gemini API

  .

* Google — Documentação do Gemini Flash-Lite

  .

Nota de escopo: este documento considera os custos de consumo dos serviços de IA e a infraestrutura local já disponível. Não inclui aquisição de computador, microfone, caixas de som, licenças de software 3D, desenvolvimento, internet dedicada ou reconhecimento de fala.
