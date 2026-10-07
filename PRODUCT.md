# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
**Quem usa:** crianças de 5 a 14 anos, com supervisão de um adulto, num totem em pé (1080x1920) num evento da UEMA. Também roda em notebook (paisagem) e celular. Cada uso é uma demonstração rápida, de uns minutos por pessoa. Confirmado pelo dono em 06/10/2026.

**Quem opera:** um adulto da organização, que liga o totem, escolhe o modo, confere o estado dos serviços e vê o gasto. Confirmado em 06/10/2026.

## Product Purpose
Personagens 3D (arquivos `.vrm` prontos) que conversam no navegador: o Gemini responde, o Kokoro fala em português e a boca se move com o áudio. Cada personagem tem um papel (Luma explica o dia a dia, Teo e Rafa resolvem problemas de matemática e engenharia com quadro e calculadora, Nina explica fenômenos).

Sucesso é a criança entender o que perguntou, sem esperar muito e sem nada que a exponha: nenhum dado dela é guardado.

## Positioning
O personagem é o produto: corpo 3D, voz em português, aceno de cumprimento e de despedida. Isto é uma leitura minha do que o projeto faz, não uma frase que o dono tenha validado; ajustar se o dono posicionar de outro jeito.

## Operating Context
Totem sem ninguém olhando entre uma criança e outra: precisa se recuperar sozinho de falhas (contexto WebGL, laço travado), apagar a conversa ao fim e voltar à atração. Pode ficar sem internet: a escada de falhas do `Repertorio/REPERTORIO.md` (seção 24) cai para respostas e áudios prontos. O gasto parte de R$ 50 (mínimo informado pelo dono em 07/10/2026; pode aumentar).

## Capabilities and Constraints
- Só `.vrm` e `.vrma` prontos. Nada de personagem, pose ou cenário criado em código (única exceção prevista: aceno simples, só com aprovação do dono).
- Personagem sem `.vrm` fica "Em breve"; nunca se cria modelo, retrato ou silhueta.
- Nenhum fato sobre a UEMA sem fonte oficial atual fornecida pelo dono: horário, contato, valor, data de vestibular.
- Câmera e microfone desligados por padrão, com consentimento. Nada de nome, escola, gravação de áudio ou de imagem de criança.
- Chaves pagas nunca no navegador, no chat nem no repositório.
- Decidido em 07/10/2026: modelo padrão do Gemini é o 3.1 Flash-Lite (R$ 21 por 5.000 respostas projetados, não medidos); o 3.5 Flash daria R$ 124 e não cabe em R$ 50. Em aberto: motor de voz premium (só pré-gravada cabe no orçamento).

## Brand Commitments
Identidade **neutra**. Não há material oficial da UEMA: não recriar nem imitar o logotipo. Nada na interface pode sugerir que a pixiv ou o VRoid apoia ou recomenda o evento. Sem travessão (—) em texto de interface e em falas dos personagens, sem abertura genérica, sem enchimento.

## Evidence on Hand
Cinco `.vrm` (quatro CC0 do 100Avatars e o sample do VRoid Hub), sete clipes do pacote VRMA do VRoid, o `idle` do ChatVRM e um aceno do Mixamo. Licenças em `assets/avatars/CREDITS.md` e `assets/animations/CREDITS.md`. **Não há** material oficial da UEMA, nem depoimentos, nem números de uso: nada disso deve ser inventado.

## Product Principles
1. O personagem lidera; a interface recua.
2. Um próximo passo por etapa, sempre visível.
3. O que o personagem diz está sempre escrito na tela.
4. Se algo quebra, a criança vê um aviso com uma saída, nunca um erro técnico.
5. Nenhum dado de criança é guardado.

## Accessibility & Inclusion
Alvos de toque grandes (44 px hoje; a fase 5 pede 56 px no quiosque), contraste AA medido por teste, foco visível, navegação por teclado, `prefers-reduced-motion` respeitado, modo calmo e legenda sempre visível.
