# Direção visual

**Modo:** a tela do personagem é **Experience** (o personagem lidera, a interface recua). O painel de configurações é **Operate** (clareza e consistência acima de expressão).

**Botões da `design-taste-frontend`:** variância 3, movimento 3 (só na interface; o corpo do personagem fica fora desse botão), densidade 4. Produto infantil e institucional: acessibilidade e confiança vêm antes do gosto.

**Identidade:** neutra. Não há material oficial da UEMA; nada imita o logotipo e nada sugere apoio da pixiv ou do VRoid.

**Cena de uso:** totem em pé (1080×1920), lido a ~1 m, por crianças de 5 a 14 anos, com supervisão. Também roda em notebook (paisagem) e celular.

## Princípios
1. **O personagem é a marca.** Cada um traz paleta e tipografia nos dados (`src/characters.js` → `paleta`). Nenhum CSS por personagem.
2. **Texto falado sempre visível.** O balão mostra exatamente o que está sendo dito.
3. **O quadro é um elemento próprio, não um balão.** Teo e Rafa mostram passos, contas e resposta numa área com fonte própria.
4. **Estado à vista, sem animação decorativa.** O ponto colorido e a linha de estado mostram ocioso, ouvindo, pensando ou falando. O selo do palco mostra o motor de voz. O aviso vermelho mostra a câmera ligada.
5. **Alvos de 44 px ou mais** em tudo que se toca. Foco visível com contorno de 3 px.
6. **Um próximo passo por etapa** (P5): atração, cumprimento, consentimento, conversa, despedida. O cartão de etapa usa a cor de ação do personagem no botão principal; a alternativa é um link sublinhado, nunca um segundo botão igual.

## Movimento
Só `transform` e `opacity`, e tudo some com `prefers-reduced-motion`:
- troca de personagem: fade do canvas, 160 ms;
- "ouvindo": pulso de opacidade do ponto;
- cartão de etapa: entra subindo 8 px com fade, 220 ms, ease-out;
- botão principal e microfone: afundam 3 a 4 px no toque (`translateY`); a sombra muda sem transição;
- barra de carregamento: `scaleX` acompanhando os bytes reais do `.vrm`.

## Espaçamento
Escala de 4 px: 6, 8, 10, 12, 14, 18, 20, 26. Raio 12 (controles), 16 a 18 (balão e cartão), 999 (pílulas). Painel com 12 a 14 px de margem; nada encosta na borda da tela.

## Tipografia (e por quê)
| Uso | Fonte | Motivo |
|---|---|---|
| Luma, Nina | **Baloo 2** | Arredondada e de traço cheio, lê bem para quem está aprendendo a ler. Cobre todos os acentos do português. |
| Teo, Rafa | **Atkinson Hyperlegible** | Feita pelo Braille Institute para separar letras que se confundem (I/l/1, O/0). Quem lê números precisa disso. |
| Quadro | **JetBrains Mono** + `tabular-nums slashed-zero` | Mono para alinhar as contas; 0 com ponto e 1 com base, diferentes de O e l. |

A base do texto escala com a tela: 16 px no celular e ~22 px no totem (`clamp(16px, 10px + 1.1vmin, 24px)`).

## Paleta (e por quê)
| Personagem | Fundo | Ação | Motivo |
|---|---|---|---|
| Luma | azul-céu claro | coral | Luz de dia, sala de aula. O coral do microfone é o botão óbvio para criança pequena. |
| Teo | grafite escuro | laranja | Quadro-negro: o quadro de contas fica em destaque, e o laranja chama sem cansar. |
| Rafa | papel-cru | azul-prancheta | Papel de desenho técnico. Sóbrio. |
| Nina | verde-menta | verde-laboratório + âmbar | Ciência, natureza, experimento. |

Os textos sobre fundo seguem contraste AA. O "?" de número não conferido usa laranja-claro com texto marrom, igual ao alerta do selo de voz: um único sinal de atenção no app inteiro.

## Layout
- **Retrato (totem, celular):** uma coluna com seletor, palco, quadro (só Teo e Rafa) e conversa. O palco nunca fica com menos de 32vh; quem rola é o quadro.
- **Paisagem (≥ 900 px, proporção ≥ 5:4):** o palco fica à esquerda e o quadro e a conversa à direita.

## O que não usamos (seção 10 do REPERTORIO)
Gradiente roxo, brilho neon, vidro/blur, borda colorida lateral, emoji como ícone (os ícones são SVG de traço único), grade de três cartões iguais, easing com quique.

Verificação: `npx impeccable@4.1.0 detect index.html comparar-lipsync.html` sem achados (01/10/2026, antes e depois do P6).
