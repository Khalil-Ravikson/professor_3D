// Catálogo de clipes (assets/animations/animacoes.json) com as escolhas do operador por cima.
// O JSON é o padrão; a galeria grava só o que mudou (status e infantilOk) em prof3d_animacoes.
import { lerJSON, gravarJSON } from './storage.js';

const CHAVE = 'animacoes';

export async function carregarCatalogo(url = 'assets/animations/animacoes.json') {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`catálogo de animações ausente: ${url} (HTTP ${resp.status})`);
  return resp.json();
}

// Junta o catálogo com as escolhas salvas. Não altera o objeto original.
export function aplicarEscolhas(catalogo, escolhas = lerJSON(CHAVE, {})) {
  return catalogo.clipes.map((c) => ({ ...c, ...(escolhas[c.id] || {}) }));
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
