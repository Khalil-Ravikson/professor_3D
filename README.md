# Professores 3D

Personagens 3D (VRM) que conversam no navegador. O Gemini responde, o Kokoro fala em português, e a boca se move com o áudio.

## Rodar

1. Suba o servidor de voz Kokoro (Docker Desktop precisa estar aberto):

   ```bash
   docker run -d --restart unless-stopped --name kokoro -p 127.0.0.1:8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:v0.9.0
   ```

   Nas próximas vezes: `docker start kokoro`. Para parar: `docker stop kokoro`.
   A imagem tem ~5 GB. O `127.0.0.1` impede que outras máquinas da rede usem o servidor.

2. Sirva a pasta:

   ```bash
   python serve.py
   ```

   Abra `http://localhost:8770`. Não use `file://`: o `.vrm` e o áudio precisam de HTTP.
   O `serve.py` desliga o cache; com `python -m http.server`, o navegador fica com o `.js` antigo depois de uma edição.

3. Na engrenagem, coloque a chave do Gemini. Ela fica só neste navegador.

## Voz

| Motor | Quando usar |
|---|---|
| Kokoro no servidor local | Padrão. Único caminho com vozes em português (`pf_dora`, `pm_alex`, `pm_santa`). |
| Kokoro no navegador | Só inglês: o `kokoro-js` 1.2.1 não expõe vozes em português. Baixa ~310 MB na primeira vez (WebGPU). |
| Voz do sistema | Reserva automática quando o servidor não responde. O selo no canto do palco avisa. |

- **CORS:** o Kokoro-FastAPI v0.9.0 responde `access-control-allow-origin: *`, então a página chama direto, sem configuração.
- **Desempenho:** em CPU de 4 núcleos, uma frase leva de 1 a 3 s para ficar pronta. Com outros programas pesados abertos, aparecem pausas entre as frases.

### Vozes grátis do Microsoft Edge

No Edge aparecem vozes neurais em português ("Microsoft Francisca Online (Natural)", "Antonio"). No modo de voz **Automático** (o padrão), o app usa essas vozes quando elas existem: Francisca para Luma e Nina, Antonio para Teo e Rafa. Quando não existem, usa o Kokoro.

Duas ressalvas: elas precisam de internet, e a boca se mexe por palavra, não pelo áudio.

## Teo e Rafa: quadro e calculadora

- Esses dois respondem em linhas `FALA:` (vai para a voz) e `QUADRO:` (vai para o quadro).
- Toda conta passa pela função `calcular` (mathjs, no navegador).
- Número no quadro que não veio do enunciado, de uma "Suposição:" nem da calculadora aparece como **?**.

## Câmera

- **Ligar e desligar:** pelo botão de câmera no palco. Ela começa desligada e não liga sozinha. Enquanto está ligada, aparece "Câmera ligada" em vermelho.
- **O que faz:**
  - cumprimenta quando alguém aparece (no máximo uma vez a cada 45 s);
  - o olhar acompanha a pessoa;
  - sorri de volta;
  - tem um modo espelho opcional, em que o avatar imita o rosto.
- **Privacidade:** a imagem nunca sai do computador. Nada é gravado, salvo ou enviado; só a posição do rosto e o sorriso viram números usados na hora.
- **Recursos:** a inferência roda a 15 quadros por segundo e pausa com a aba oculta. O modelo fica em `assets/mediapipe/`.

## Ajustes por personagem

Em Configurações → Personagem dá para mudar instruções, limite de palavras faladas, temperatura, voz Kokoro e velocidade. Os ajustes ficam neste navegador; "Restaurar" volta ao padrão de `src/characters.js`.

- **Temperatura:** nos modelos Gemini 3, a Google recomenda deixar no padrão (1,0).

## Avatares

Ficam em `assets/avatars/<nome>.vrm`. O seletor só mostra personagens cujo arquivo existe. Autor, fonte e licença de cada um estão em `assets/avatars/CREDITS.md`.

Onde conseguir `.vrm`:

- **opensourceavatars.com:** CC0. A coleção 100Avatars R3 tem expressões completas.
- **VRoid Hub:** a licença varia por modelo. Se não for CC0, não commite o arquivo.

## Animações e boca

- **Corpo:** só por VRMA, em `assets/animations/<nome>.vrma`. Hoje só existe `idle` (do ChatVRM, MIT). `talk`, `think` e `greet` usam o `idle` até você colocar os arquivos. Veja `assets/animations/CREDITS.md` para saber onde conseguir cada um e o que a licença permite.
- **Boca:** segue o áudio que está tocando. O padrão pega o formato da vogal do wLipSync e a abertura do volume. Dá para trocar em Configurações → Movimento da boca.
- **Comparar os métodos:** `comparar-lipsync.html` mostra o mesmo áudio em três avatares lado a lado.

## Adicionar um personagem

1. Coloque o `.vrm` em `assets/avatars/`.
2. Acrescente um objeto em `src/characters.js`, copiando um existente. Os campos principais:
   - `id` e `nome`;
   - `arquivoVrm`;
   - `persona` (o prompt do personagem);
   - `voz` (`{ motor, id, speed }`);
   - `enquadramento`;
   - `atalhos`;
   - `paleta`.
3. Recarregue. A miniatura é gerada sozinha a partir do modelo.

`voz.id` aceita mistura de vozes no formato do servidor, por exemplo `pm_alex(1)+pm_santa(1)`.

## Design

Direção visual, tipografia e paleta (com o motivo de cada escolha) em `DESIGN.md`. A interface funciona em retrato (totem 1080×1920, celular) e em paisagem (avatar à esquerda, quadro e conversa à direita).

## Testes

```bash
npm install
npx playwright install chromium
npm test
```

- **Unitários** (`tests/unit`): o divisor de frases e o leitor do streaming do Gemini.
- **Ponta a ponta** (`tests/e2e`, Playwright): abrir, trocar personagem sem vazar memória, falar com o Kokoro, Parar, e cair para a voz do sistema.
- **Gemini simulado:** nos testes ele é sempre simulado, e nenhuma chamada sai para a internet.
- **Kokoro real:** os testes usam o servidor de verdade. Se ele estiver fora do ar, o teste de voz é pulado.

Abrir o app com `?debug` na URL expõe `window.__prof3d` para inspeção no console.
