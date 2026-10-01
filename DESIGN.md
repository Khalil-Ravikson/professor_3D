# Direção visual

**Modo:** Operate. A criança (ou o supervisor) faz uma pergunta e ouve a resposta. A interface sai do caminho: quem aparece é o personagem.

**Cena de uso:** totem em pé (1080×1920), lido a ~1 m, por crianças de 5 a 14 anos, com supervisão. Também roda em notebook (paisagem) e celular.

## Princípios
1. **O personagem é a marca.** Cada um traz paleta e tipografia nos dados (`src/characters.js` → `paleta`). Nenhum CSS por personagem.
2. **Texto falado sempre visível.** O balão mostra exatamente o que está sendo dito.
3. **O quadro é um elemento próprio, não um balão.** Teo e Rafa mostram passos, contas e resposta numa área com fonte própria.
4. **Estado à vista, sem animação decorativa.** O ponto colorido e a linha de estado mostram ocioso, ouvindo, pensando ou falando. O selo do palco mostra o motor de voz. O aviso vermelho mostra a câmera ligada. As únicas animações são o fade da troca de personagem (160 ms) e o pulso do "ouvindo", e as duas somem com `prefers-reduced-motion`.
5. **Alvos de 44 px ou mais** em tudo que se toca. Foco visível com contorno de 3 px.

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

Verificação: `npx impeccable@4.1.0 detect index.html comparar-lipsync.html` sem achados (01/10/2026).
