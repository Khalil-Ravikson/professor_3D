// Prosódia por frase (pedido do dono em 08/10/2026: "melhorar as expressões da voz" no Kokoro, na voz Microsoft e nas demais).
// Cada sentença ganha um fator de ritmo e de tom conforme a emoção marcada pelo modelo ([emo:...]) e a pontuação: pergunta sobe o tom, exclamação
// acelera um pouco, reticências desaceleram, frase curtinha vai mais devagar para ficar clara. O pedido de síntese leva `speed` (Kokoro, voz do
// sistema) e `pitch` (voz do sistema; o Kokoro não tem controle de tom). Gemini TTS, ElevenLabs e áudio importado têm estilo próprio e ignoram isto.
// Puro e testável. Os fatores são pequenos de propósito: voz de criança-professora não pode virar caricatura. NÃO foram ouvidos num dispositivo
// real: itens 115 e 116 de Repertorio/TESTES-MANUAIS.md.

const BASE = {
  neutro: { rate: 1, pitch: 1 },
  alegre: { rate: 1.07, pitch: 1.08 },
  pensativo: { rate: 0.93, pitch: 0.95 },
  surpreso: { rate: 1.05, pitch: 1.12 },
  curioso: { rate: 1, pitch: 1.06 },
  empatico: { rate: 0.92, pitch: 0.94 },
};
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

export function prosodia(texto, emocao) {
  const b = BASE[emocao] || BASE.neutro;
  let rate = b.rate, pitch = b.pitch;
  const t = String(texto || '').trim();
  if (/\?["')\]]*$/.test(t)) { pitch *= 1.05; rate *= 0.98; }
  else if (/!["')\]]*$/.test(t)) { pitch *= 1.04; rate *= 1.03; }
  else if (/(\.\.\.|…)["')\]]*$/.test(t)) { pitch *= 0.97; rate *= 0.93; }
  if (t && t.split(/\s+/).length <= 3) rate *= 0.97;
  return { rate: +limitar(rate, 0.8, 1.25).toFixed(3), pitch: +limitar(pitch, 0.85, 1.2).toFixed(3) };
}

// Voz do personagem com a prosódia desta frase. `voz` pode ser null (sem personagem): devolve igual.
export function vozComProsodia(voz, texto, emocao, ligada = true) {
  if (!voz || !ligada) return voz;
  const p = prosodia(texto, emocao);
  return { ...voz, speed: +limitar((voz.speed || 1) * p.rate, 0.5, 2).toFixed(3), pitch: +((voz.pitch || 1) * p.pitch).toFixed(3) };
}

// Pausa (ms) DEPOIS de uma frase, antes da próxima: pergunta e reticências pedem um respiro maior, exclamação e alegria, menor.
export function pausaAposFrase(texto, emocao, base) {
  const t = String(texto || '').trim();
  let pausa = base;
  if (/\?["')\]]*$/.test(t)) pausa += 120;
  else if (/(\.\.\.|…)["')\]]*$/.test(t)) pausa += 220;
  else if (/!["')\]]*$/.test(t)) pausa -= 40;
  if (emocao === 'pensativo' || emocao === 'empatico') pausa += 100;
  if (emocao === 'alegre') pausa -= 30;
  return Math.max(60, Math.round(pausa));
}
