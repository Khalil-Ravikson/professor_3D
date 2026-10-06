// Vigia do laço de renderização (P9). Num quiosque ninguém está olhando para a tela
// quando ela congela, então o app se recarrega sozinho.
//
// Duas armadilhas tratadas aqui:
// 1. Aba oculta: o navegador para o requestAnimationFrame. Isso não é travamento,
//    e o relógio do vigia só anda enquanto a página está visível.
// 2. Laço de recarga: se o app travar de novo logo depois de recarregar, recarregar
//    outra vez não resolve nada. Depois de um número de tentativas, desiste e avisa.

const CHAVE = 'prof3d_recargas';

export function contarRecargas() {
  // Sem sessionStorage (modo privado, cookies bloqueados) o vigia perde a memória das
  // tentativas e volta a tratar cada travamento como o primeiro. É pior do que contar,
  // e melhor do que deixar a tela congelada. O motivo não vai ao console porque esta
  // função roda a cada rodada do vigia e a cada desenho do painel.
  try { return Number(sessionStorage.getItem(CHAVE) || 0); } catch { return 0; }
}
function anotarRecarga(n) {
  try { sessionStorage.setItem(CHAVE, String(n)); } catch (e) { console.warn('[vigia] não consegui anotar a recarga:', e); }
}
// Chamado quando o app chega inteiro ao fim do início: a contagem recomeça.
export function esquecerRecargas() {
  try { sessionStorage.removeItem(CHAVE); } catch (e) { console.warn('[vigia] não consegui limpar a contagem:', e); }
}

export function criarVigia({
  ultimoQuadro,                 // () => performance.now() do último quadro desenhado
  limiteMs = 10_000,            // sem quadro por este tempo, com a aba visível, é travamento
  intervaloMs = 1_000,
  maxRecargas = 3,
  aoTravar,                     // (info) => void: avisa antes de recarregar
  aoDesistir,                   // (info) => void: já recarregou demais, mostra a tela de erro
  recarregar = () => location.reload(),
  agora = () => performance.now(),   // relógio trocável: os testes não esperam de verdade
} = {}) {
  let timer = null, visivelDesde = agora(), ultimaChecagem = agora(), disparou = false;

  function aoMudarVisibilidade() {
    if (!document.hidden) visivelDesde = agora();
  }

  function checar() {
    const t = agora();
    const desdeAUltima = t - ultimaChecagem;
    ultimaChecagem = t;
    if (disparou) return;
    // Aba oculta: o navegador para o requestAnimationFrame de propósito. Enquanto isso
    // o relógio do vigia anda junto, para que a volta à aba comece do zero.
    if (document.hidden) { visivelDesde = t; return; }
    // O próprio vigia ficou sem rodar: aba em segundo plano (o navegador estrangula o
    // setInterval), máquina suspensa ou thread ocupada. Nesta rodada não dá para separar
    // travamento de pausa, então o relógio recomeça e a próxima rodada decide.
    if (desdeAUltima > limiteMs) { visivelDesde = t; return; }
    // Logo depois de voltar à aba, o primeiro quadro ainda não veio; não conta.
    const paradoHa = t - Math.max(ultimoQuadro(), visivelDesde);
    if (paradoHa < limiteMs) return;
    disparou = true;
    const n = contarRecargas() + 1;
    const info = { paradoHa: Math.round(paradoHa), tentativa: n, maxRecargas };
    console.error(`[vigia] o laço de renderização parou há ${info.paradoHa} ms (tentativa ${n} de ${maxRecargas}).`);
    if (n > maxRecargas) { if (aoDesistir) aoDesistir(info); return; }
    anotarRecarga(n);
    if (aoTravar) aoTravar(info);
    recarregar();
  }

  return {
    iniciar() {
      if (timer) return;
      visivelDesde = ultimaChecagem = agora();
      document.addEventListener('visibilitychange', aoMudarVisibilidade);
      timer = setInterval(checar, intervaloMs);
    },
    parar() {
      clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    },
    // Para os testes e para o painel do operador.
    checarAgora: checar,
    get armado() { return !!timer && !disparou; },
  };
}
