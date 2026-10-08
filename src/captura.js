// Foto e vídeo do AVATAR (prompt 7, V4). Capturam só o canvas da cena (o personagem), NUNCA a imagem da webcam nem a interface; salvam no próprio
// computador, sem envio. Foto: PNG com fundo escolhido ou transparente, na proporção pedida, com contagem regressiva. Vídeo: captureStream do canvas
// composto + MediaRecorder, com duração máxima e indicador de gravação. O nome do arquivo não leva dado pessoal (só personagem e data).
export const PROPORCOES = { '1:1': [1, 1], '4:5': [4, 5], '16:9': [16, 9], '9:16': [9, 16] };
const FORMATOS_VIDEO = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

// Recorte centralizado da fonte (wSrc x hSrc) na proporção pedida.
export function recorte(wSrc, hSrc, proporcao) {
  const [pw, ph] = PROPORCOES[proporcao] || PROPORCOES['1:1'];
  const alvo = pw / ph;
  let sw = wSrc, sh = wSrc / alvo;
  if (sh > hSrc) { sh = hSrc; sw = hSrc * alvo; }
  return { sx: Math.round((wSrc - sw) / 2), sy: Math.round((hSrc - sh) / 2), sw: Math.round(sw), sh: Math.round(sh) };
}
export function tamanhoSaida(proporcao, ladoMax = 1080) {
  const [pw, ph] = PROPORCOES[proporcao] || PROPORCOES['1:1'];
  const k = ladoMax / Math.max(pw, ph);
  return { w: Math.round(pw * k), h: Math.round(ph * k) };
}
// Primeiro formato que o navegador grava, ou null (aí a interface avisa que não há suporte).
export function formatoDeVideo(isTypeSupported) {
  return FORMATOS_VIDEO.find((f) => { try { return isTypeSupported(f); } catch { return false; } }) || null;
}
export function nomeDoArquivo(prefixo, extensao, data = new Date()) {
  const seguro = String(prefixo).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'avatar';
  const d = data.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${seguro}-${d}.${extensao}`;
}

// Desenha um quadro composto em ctx (largura w, altura h): fundo, o avatar recortado, moldura e crédito.
export function desenharQuadro(ctx, fonte, { w, h, proporcao, fundo = null, moldura = false, credito = '' }) {
  ctx.clearRect(0, 0, w, h);
  if (fundo) { ctx.fillStyle = fundo; ctx.fillRect(0, 0, w, h); }
  const r = recorte(fonte.width, fonte.height, proporcao);
  ctx.drawImage(fonte, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
  if (moldura) { ctx.lineWidth = Math.max(6, w / 90); ctx.strokeStyle = '#ffffff'; ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth); }
  if (credito) {
    const tam = Math.max(12, Math.round(w / 60));
    ctx.font = `${tam}px system-ui, sans-serif`;
    const larg = Math.min(w - 16, ctx.measureText(credito).width + 16);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, h - tam * 2 - 8, larg, tam * 1.7);
    ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(credito, 16, h - tam * 1.15 - 8, w - 32);
  }
}

// cena: { renderer, scene, camera } de scene.js. aoEstado({ gravando, restante, contagem }) para a interface.
export function criarCaptura({ cena, aoEstado = () => {} }) {
  let gravador = null, parar = null, timer = null;
  const renderizar = () => cena.renderer.render(cena.scene, cena.camera); // o canvas WebGL só é legível logo depois do render, na mesma tarefa
  const novoCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  async function foto(opc, { contagemS = 3, esperar = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    for (let n = contagemS; n > 0; n--) { aoEstado({ contagem: n }); await esperar(1000); }
    aoEstado({ contagem: 0 });
    const { w, h } = tamanhoSaida(opc.proporcao);
    const c = novoCanvas(w, h), ctx = c.getContext('2d');
    renderizar();
    desenharQuadro(ctx, cena.renderer.domElement, { w, h, ...opc });
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Não consegui gerar a imagem.'))), 'image/png'));
  }

  async function video(opc, { duracaoMaxS = 15 } = {}) {
    if (gravador) throw new Error('Já está gravando.');
    const mime = formatoDeVideo((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
    if (!mime) throw new Error('Este navegador não grava vídeo do canvas. Use a foto.');
    const { w, h } = tamanhoSaida(opc.proporcao, 720);
    const c = novoCanvas(w, h), ctx = c.getContext('2d');
    const stream = c.captureStream(30);
    gravador = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    const pedacos = [];
    gravador.ondataavailable = (e) => { if (e.data && e.data.size) pedacos.push(e.data); };
    let ativo = true;
    const quadro = () => { if (!ativo) return; renderizar(); desenharQuadro(ctx, cena.renderer.domElement, { w, h, ...opc }); requestAnimationFrame(quadro); };
    const t0 = performance.now();
    return new Promise((resolver, rejeitar) => {
      gravador.onerror = (e) => { ativo = false; clearInterval(timer); gravador = null; rejeitar(e.error || new Error('Falha na gravação.')); };
      gravador.onstop = () => { ativo = false; clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); gravador = null; aoEstado({ gravando: false, restante: 0 }); resolver({ blob: new Blob(pedacos, { type: mime.split(';')[0] }), mime }); };
      parar = () => { if (gravador && gravador.state !== 'inactive') gravador.stop(); };
      gravador.start(500);
      quadro();
      aoEstado({ gravando: true, restante: duracaoMaxS });
      timer = setInterval(() => {
        const rest = Math.max(0, Math.ceil(duracaoMaxS - (performance.now() - t0) / 1000));
        aoEstado({ gravando: true, restante: rest });
        if (rest <= 0) parar();
      }, 250);
    });
  }

  return { foto, video, pararVideo() { if (parar) parar(); }, get gravando() { return !!gravador; } };
}

// Entrega o arquivo ao usuário (download local). Nada é enviado.
export function salvarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
