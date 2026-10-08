// Catálogo de clipes (assets/animations/animacoes.json) com as escolhas do operador por cima.
// O JSON é o padrão; a galeria grava só o que mudou (status e infantilOk) em prof3d_animacoes.
import { lerJSON, gravarJSON } from './storage.js';

const CHAVE = 'animacoes';

export async function carregarCatalogo(url = 'assets/animations/animacoes.json') {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`catálogo de animações ausente: ${url} (HTTP ${resp.status})`);
  return resp.json();
}

// Num clone limpo faltam os arquivos que a licença impede de commitar (pacote do VRoid, aceno do Mixamo). Clipe ativo cujo arquivo não existe vira
// `ausente` (c.ausente = true): some das listas e do loop, em vez de dar 404 e miniatura vazia. Só um 404 conta; rede fora do ar não decide nada.
export async function marcarAusentes(catalogo, buscar = (u, o) => fetch(u, o)) {
  const ausentes = [];
  await Promise.all(catalogo.clipes.filter((c) => c.status === 'ativo' && c.arquivo && !String(c.arquivo).startsWith('enviado:')).map(async (c) => {
    try {
      const r = await buscar(c.arquivo, { method: 'HEAD' });
      if (r.status === 404) { c.ausente = true; ausentes.push(c.id); }
    } catch (e) {
      console.warn(`[animacoes] não consegui conferir "${c.arquivo}":`, e);
    }
  }));
  return ausentes;
}

// Junta o catálogo com as escolhas salvas. Não altera o objeto original. Clipe ausente fica ausente, mesmo que o operador o tenha ligado antes.
export function aplicarEscolhas(catalogo, escolhas = lerJSON(CHAVE, {})) {
  return catalogo.clipes.map((c) => { const m = { ...c, ...(escolhas[c.id] || {}) }; if (c.ausente) m.status = 'ausente'; return m; });
}

// Grava a escolha de um clipe; se voltar ao padrão do JSON, apaga a entrada.
export function gravarEscolha(catalogo, id, campo, valor) {
  const escolhas = lerJSON(CHAVE, {});
  const padrao = catalogo.clipes.find((c) => c.id === id);
  if (!padrao) return escolhas;
  const e = { ...(escolhas[id] || {}), [campo]: valor };
  if (padrao[campo] === valor) delete e[campo];
  if (Object.keys(e).length) escolhas[id] = e; else delete escolhas[id];
  gravarJSON(CHAVE, escolhas);
  return escolhas;
}

// Clipes que a máquina de estados pode usar agora.
export function clipesUsaveis(clipes, { infantil = false } = {}) {
  return clipes.filter((c) => c.status === 'ativo' && (!infantil || c.infantilOk));
}
