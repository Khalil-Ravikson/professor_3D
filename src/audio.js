// Mesa de som: volume do público, redução do fundo quando alguém fala e
// normalização de volume das frases sintetizadas (P8).
//
// Medida usada: RMS e pico em dBFS, calculados sobre as amostras do AudioBuffer.
// NÃO é LUFS do EBU R128: isso exigiria a ponderação K (filtros de pré-ênfase e
// passa-alta) e janelas de 400 ms com porta de silêncio. Para igualar o volume de
// frases curtas de fala o RMS com porta de silêncio resolve, e o teto de pico
// evita corte. Para o pacote pré-gravado, a normalização certa é o `loudnorm`
// do ffmpeg (ver tools/normalizar-audio.mjs).

// Alvos. Em dBFS porque é o que medimos.
export const ALVO = {
  rmsDb: -20,        // volume médio de fala confortável sem chegar perto do corte
  tetoPicoDb: -1.5,  // margem para o pico, mesmo depois do ganho
  ganhoMaxDb: 12,    // trava: não empurrar um áudio quase mudo até o ruído aparecer
  ganhoMinDb: -12,
  pisoDb: -60,       // amostras abaixo disso não entram no RMS (silêncio entre palavras)
};

// Ducking: quanto o áudio do personagem cai enquanto o microfone está aberto.
export const FATOR_FUNDO = 0.3;
// Rampa do ganho. Degrau seco em gain estala; 60 ms não é percebido como atraso.
// Rampa linear, e não setTargetAtTime, porque o mudo precisa chegar a zero de verdade:
// a aproximação exponencial deixa um fio de som para sempre.
const RAMPA_S = 0.06;
// Intervalo entre sentenças. Constante, não depende do motor nem do tamanho da frase.
export const PAUSA_ENTRE_FRASES_MS = 180;

// Abaixo disso a porta de silêncio é desligada: o arquivo todo é baixo, não silencioso.
const MINIMO_APROVEITADO = 0.02;

const dbParaGanho = (db) => 10 ** (db / 20);
const ganhoParaDb = (g) => 20 * Math.log10(g);
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

// Volume do controle (0 a 1) para ganho. Ao quadrado porque a percepção de volume
// não é linear: na metade do curso o som precisa soar pela metade, não a 70%.
export const curvaVolume = (v) => limitar(v, 0, 1) ** 2;

// RMS e pico de um AudioBuffer, em dBFS. -Infinity quando não há som.
// Aceita qualquer objeto com numberOfChannels e getChannelData.
export function medirBuffer(buffer) {
  const piso = dbParaGanho(ALVO.pisoDb);
  let soma = 0, n = 0, somaTudo = 0, total = 0, pico = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const dados = buffer.getChannelData(c);
    for (let i = 0; i < dados.length; i++) {
      const a = Math.abs(dados[i]);
      if (a > pico) pico = a;
      somaTudo += dados[i] * dados[i];
      total++;
      if (a >= piso) { soma += dados[i] * dados[i]; n++; }
    }
  }
  const aproveitado = total ? n / total : 0;
  // Gravação muito baixa fica inteira abaixo do piso. Nesse caso o piso não serve
  // de porta de silêncio, serve de cegueira: mede-se tudo.
  const usarPorta = aproveitado >= MINIMO_APROVEITADO;
  const quadrados = usarPorta ? soma / n : total ? somaTudo / total : 0;
  return {
    rmsDb: quadrados > 0 ? +ganhoParaDb(Math.sqrt(quadrados)).toFixed(2) : -Infinity,
    picoDb: pico ? +ganhoParaDb(pico).toFixed(2) : -Infinity,
    // Fração do áudio acima do piso. Se for muito baixa, o trecho é quase todo silêncio.
    aproveitado: +aproveitado.toFixed(3),
    comPorta: usarPorta,
  };
}

// Ganho que leva o RMS ao alvo sem o pico passar do teto, dentro das travas.
// Devolve as medidas de antes e as previstas para depois, para o relatório.
export function planejarNormalizacao(buffer) {
  const antes = medirBuffer(buffer);
  if (!Number.isFinite(antes.rmsDb)) return { ganho: 1, ganhoDb: 0, antes, depois: antes, motivo: 'sem som' };
  let ganhoDb = ALVO.rmsDb - antes.rmsDb;
  let motivo = 'alvo de RMS';
  const folgaDePico = ALVO.tetoPicoDb - antes.picoDb;
  if (ganhoDb > folgaDePico) { ganhoDb = folgaDePico; motivo = 'limitado pelo teto de pico'; }
  if (ganhoDb > ALVO.ganhoMaxDb) { ganhoDb = ALVO.ganhoMaxDb; motivo = 'limitado pelo ganho máximo'; }
  if (ganhoDb < ALVO.ganhoMinDb) { ganhoDb = ALVO.ganhoMinDb; motivo = 'limitado pelo ganho mínimo'; }
  ganhoDb = +ganhoDb.toFixed(2);
  return {
    ganho: dbParaGanho(ganhoDb),
    ganhoDb,
    antes,
    depois: {
      rmsDb: +(antes.rmsDb + ganhoDb).toFixed(2),
      picoDb: +(antes.picoDb + ganhoDb).toFixed(2),
      aproveitado: antes.aproveitado,
      comPorta: antes.comPorta,
    },
    motivo,
  };
}

// A mesa controla o ganho de saída (volume e redução de fundo) e guarda o que foi
// normalizado, para o painel do operador e para o relatório.
export function criarMesa({ ctx, saida, volumeInicial = 0.8, mudoInicial = false, aoMudar = () => {} }) {
  let volume = limitar(volumeInicial, 0, 1), mudo = !!mudoInicial, fundoAbaixado = false;
  const medidas = []; // últimas 60 normalizações

  function aplicar() {
    const alvo = mudo ? 0 : curvaVolume(volume) * (fundoAbaixado ? FATOR_FUNDO : 1);
    const agora = ctx.currentTime;
    // Segura o valor de agora e rampa a partir dele; sem isso as rampas se empilham
    // e o ganho salta ao mexer no controle duas vezes seguidas.
    if (saida.gain.cancelAndHoldAtTime) saida.gain.cancelAndHoldAtTime(agora);
    else { saida.gain.cancelScheduledValues(agora); saida.gain.setValueAtTime(saida.gain.value, agora); }
    saida.gain.linearRampToValueAtTime(alvo, agora + RAMPA_S);
    aoMudar({ volume, mudo, fundoAbaixado, ganhoAlvo: +alvo.toFixed(3) });
  }

  aplicar();

  return {
    get volume() { return volume; },
    get mudo() { return mudo; },
    get fundoAbaixado() { return fundoAbaixado; },
    get ganhoAlvo() { return mudo ? 0 : +(curvaVolume(volume) * (fundoAbaixado ? FATOR_FUNDO : 1)).toFixed(3); },
    get medidas() { return medidas.slice(); },
    definirVolume(v) {
      const novo = limitar(Number(v) || 0, 0, 1);
      if (novo === volume && !mudo) return;
      volume = novo;
      if (novo > 0) mudo = false;
      aplicar();
    },
    alternarMudo(forcar) {
      const novo = forcar === undefined ? !mudo : !!forcar;
      if (novo === mudo) return mudo;
      mudo = novo;
      aplicar();
      return mudo;
    },
    // Chamado quando o microfone abre e fecha.
    abaixarFundo(sim) {
      const novo = !!sim;
      if (novo === fundoAbaixado) return;
      fundoAbaixado = novo;
      aplicar();
    },
    // Ganho por frase, para a fonte de áudio daquela frase.
    normalizar(buffer, rotulo = '') {
      const plano = planejarNormalizacao(buffer);
      medidas.push({ rotulo, duracao: +buffer.duration.toFixed(2), ...plano });
      if (medidas.length > 60) medidas.shift();
      return plano;
    },
  };
}
