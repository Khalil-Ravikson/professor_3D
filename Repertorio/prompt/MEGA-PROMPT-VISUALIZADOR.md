# PROMPT 06: visualizador de personagem estilo VRoid Hub (câmera, rastreamento, reset, tela cheia, loop de animações)

Cole abaixo da linha. Rode depois que o app tiver o catálogo de animações (fase 04).

---

Leia repertorio/REPERTORIO.md (seções 3, 25 e 28) e repertorio/PROGRESSO.md antes de começar.

TAREFA: criar um visualizador de personagem no estilo da demonstração do VRoid Hub, com câmera, rastreamento, reset, tela cheia e loop de animações. Vai na tela do personagem e na galeria de animações do painel do operador. Responda em português do Brasil.

## SKILLS (use as que estiverem instaladas e diga quais usou)

| Etapa | Skill | Uso |
|---|---|---|
| Plano | `impeccable shape`, `design-taste-frontend` | Planejar a barra de controles antes de codar. Escrever a linha "Design Read". O visualizador é modo *Experience*: o personagem lidera e os controles recuam. |
| Câmera | `threejs-interaction` | OrbitControls com `enableDamping`, `minDistance` e `maxDistance`, `maxPolarAngle`, `target`. Entrada por teclado. Boas práticas de eventos e `dispose`. |
| Canvas | `threejs-fundamentals` | Canvas responsivo, pixel ratio no máximo 2, limpeza correta ao descartar. |
| Animação | `threejs-animation` | `AnimationMixer`, `crossFadeTo`, `LoopOnce` com `clampWhenFinished`, evento `finished`, pausa do mixer. |
| VRM | `vrm-avatar-web` | Ordem de atualização, osso da cabeça, catálogo de clipes, licença no carregamento. |
| Acabamento | `impeccable animate`, `adapt`, `harden`, `polish`, depois `audit` | Movimento com propósito, retrato e paisagem, tela cheia não suportada, erros. Nessa ordem. Só então `npx impeccable detect .` |

Se uma skill não estiver instalada, siga as regras deste prompt e do REPERTORIO e avise.

## RECURSOS

1. **Câmera livre:** OrbitControls (three/addons, versão fixada). Girar, aproximar e arrastar, com mouse e toque. Alvo no peito ou na cabeça do personagem. Limites de distância e de ângulo vertical para não atravessar o chão nem virar de cabeça para baixo. Amortecimento ligado.
2. **Resetar câmera:** botão, duplo clique ou duplo toque, e a tecla R. Volta ao enquadramento padrão do personagem (campo `enquadramento` dos dados) em 0,5 s com suavização. Nada de salto seco.
3. **Rastreamento:** interruptor "Seguir personagem". A câmera acompanha o osso da cabeça com suavização, para o personagem não sair de quadro durante giros e agachamentos. Se o usuário girar a câmera à mão, pausa o rastreamento por 3 s e retoma. Se "rastreamento" também significar webcam, reaproveite o módulo de webcam que já existe e não crie outro.
4. **Tela cheia:** botão e tecla F, na API de tela cheia do navegador, no contêiner do visualizador. Trate redimensionamento e pixel ratio (máximo 2). A barra de controles some após 3 s sem movimento e volta ao mexer. Se o navegador não suportar (iPhone), use tela cheia por CSS e avise.
5. **Loop de animações:** usa só os clipes `ativos` do catálogo (`animacoes.json`). Modos: repetir um, repetir todos em sequência, aleatório. Tocar e pausar, anterior e próximo, velocidade de 0,5x a 1,5x, nome do clipe na tela. Crossfade de 0,3 s entre clipes. Com `prefers-reduced-motion`, começa pausado. Pausa com a aba oculta.

## REGRAS

- Só `.vrm` e `.vrma` prontos. Nenhuma pose criada em código.
- Por quadro: `mixer.update(dt)`, depois `vrm.update(dt)`, depois `controls.update()`.
- Ao trocar de personagem: descartar o anterior (`VRMUtils.deepDispose`) e os controles, sem vazar memória.
- Controles com ícones SVG próprios, rótulos acessíveis (aria-label), alvos de toque de 56 px ou mais, atalhos de teclado: R reset, F tela cheia, Espaço tocar ou pausar, setas para trocar de clipe, T rastreamento. Sem emoji, sem travessão, textos em `strings.pt-BR.js`.
- Estenda o que já existe. Não reescreva a galeria de animações nem o painel do operador.

## ENTREGA

Verifique em uma passada, em retrato e paisagem. Marque cada item como TESTADO ou NÃO TESTADO, com o motivo. Teste automático: o reset deve devolver a câmera ao enquadramento padrão dentro de uma tolerância. Tela cheia e toque você não testa aí; deixe esses dois num roteiro curto para o dono. Atualize repertorio/PROGRESSO.md e liste as skills usadas.
