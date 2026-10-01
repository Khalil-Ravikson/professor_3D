// Boca guiada pelo áudio que está tocando.
//  - rms: volume do AnalyserNode -> "aa". Simples e robusto; não fecha em m/b/p.
//  - wlipsync: vogais por MFCC (A E I O U) com o perfil de exemplo do wLipSync (MIT).
//  - palavras: para a voz do sistema, que não passa pelo nosso AudioContext;
//    cada evento de palavra dá um pulso de abertura.
// Os valores saem como pesos de expressão VRM: { aa, ih, ou, ee, oh }.
import { createWLipSyncNode } from 'wlipsync';

export const VISEMAS = ['aa', 'ih', 'ou', 'ee', 'oh'];
const MAPA_WLIPSYNC = { A: 'aa', I: 'ih', U: 'ou', E: 'ee', O: 'oh' };

function zerado() { return { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 }; }

// Suavização independente da taxa de quadros: tau em segundos.
function aproximar(atual, alvo, dt, tau) {
  return atual + (alvo - atual) * (1 - Math.exp(-dt / tau));
}

export function criarLipSyncRMS(analisador, { piso = 0.012, teto = 0.14, subida = 0.035, descida = 0.09 } = {}) {
  const buf = new Float32Array(analisador.fftSize);
  let abertura = 0, ultimoRms = 0;
  return {
    id: 'rms',
    get rms() { return ultimoRms; },
    ler(dt) {
      analisador.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      ultimoRms = Math.sqrt(s / buf.length);
      // Gate: abaixo do piso é silêncio. Raiz quadrada abre a boca mais cedo em volume médio.
      const alvo = ultimoRms <= piso ? 0 : Math.sqrt(Math.min(1, (ultimoRms - piso) / (teto - piso)));
      abertura = aproximar(abertura, alvo, dt, alvo > abertura ? subida : descida);
      const v = zerado();
      v.aa = abertura;
      return v;
    },
  };
}

export async function criarLipSyncWLipSync(ctx, fonte, urlPerfil = 'assets/lipsync/profile.json') {
  const r = await fetch(urlPerfil);
  if (!r.ok) throw new Error(`perfil do wLipSync não encontrado: ${urlPerfil} (HTTP ${r.status})`);
  const perfil = await r.json();
  const no = await createWLipSyncNode(ctx, perfil);
  fonte.connect(no); // o nó não tem saída de áudio; só analisa
  return {
    id: 'wlipsync',
    no,
    ler() {
      const w = no.weights, vol = no.volume;
      const v = zerado();
      for (const [fonema, visema] of Object.entries(MAPA_WLIPSYNC)) v[visema] = (w[fonema] || 0) * vol;
      // "S" (sibilante) no perfil: boca quase fechada, um pouco de "ih".
      if (w.S) v.ih = Math.max(v.ih, w.S * vol * 0.3);
      return v;
    },
    desligar() { fonte.disconnect(no); },
  };
}

// Híbrido: o FORMATO (proporção entre vogais) vem do wLipSync e a ABERTURA vem do
// envelope RMS, que treme menos e fecha no silêncio. O formato é suavizado à parte.
export function criarLipSyncHibrido(rms, wlip, { tauFormato = 0.06 } = {}) {
  const formato = { aa: 1, ih: 0, ou: 0, ee: 0, oh: 0 };
  return {
    id: 'hibrido',
    ler(dt) {
      const abertura = rms.ler(dt).aa;
      const w = wlip.ler(dt);
      const maior = Math.max(...VISEMAS.map((k) => w[k]));
      if (maior > 0.02) {
        for (const k of VISEMAS) formato[k] = aproximar(formato[k], w[k] / maior, dt, tauFormato);
      }
      // Renormaliza: a vogal mais forte fica com a abertura inteira do RMS.
      const pico = Math.max(...VISEMAS.map((k) => formato[k])) || 1;
      const v = zerado();
      for (const k of VISEMAS) v[k] = abertura * (formato[k] / pico);
      return v;
    },
  };
}

export function criarLipSyncPalavras({ descida = 0.12 } = {}) {
  let pulso = 0;
  return {
    id: 'palavras',
    marcar() { pulso = 1; },
    ler(dt) {
      pulso = aproximar(pulso, 0, dt, descida);
      const v = zerado();
      v.aa = pulso * 0.8;
      return v;
    },
  };
}

// Junta os caminhos: o áudio do AudioContext e o pulso por palavra (Web Speech).
// Um dos dois está sempre em zero, então o máximo escolhe o certo.
// modo: 'hibrido' (padrão, escolhido no comparativo do M4) | 'wlipsync' | 'rms'.
// Se o wLipSync não carregar, 'hibrido' e 'wlipsync' caem para 'rms'.
export function criarBoca({ ctx, analisador, saida, modo = 'hibrido' }) {
  const rms = criarLipSyncRMS(analisador);
  const palavras = criarLipSyncPalavras();
  let wlip = null, hib = null, modoAtual = modo, erroWlip = null;

  async function prepararWlip() {
    if (wlip || erroWlip) return wlip;
    try {
      wlip = await criarLipSyncWLipSync(ctx, saida);
      hib = criarLipSyncHibrido(criarLipSyncRMS(analisador), wlip);
    } catch (e) {
      erroWlip = e;
      console.warn('[lipsync] wLipSync indisponível, usando RMS:', e);
    }
    return wlip;
  }
  if (modo !== 'rms') prepararWlip();

  function leitor() {
    if (modoAtual === 'hibrido' && hib) return hib;
    if (modoAtual === 'wlipsync' && wlip) return wlip;
    return rms;
  }

  return {
    get modo() { return leitor().id; },
    get rms() { return rms.rms; },
    async definirModo(m) {
      modoAtual = m;
      if (m !== 'rms') await prepararWlip();
    },
    marcarPalavra() { palavras.marcar(); },
    ler(dt) {
      const l = leitor();
      const doAudio = l.ler(dt);
      if (l !== rms) rms.ler(dt); // mantém o RMS atualizado (diagnóstico e reserva)
      const p = palavras.ler(dt);
      const v = zerado();
      for (const k of VISEMAS) v[k] = Math.max(doAudio[k], p[k]);
      return v;
    },
  };
}
