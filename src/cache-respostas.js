// Cache de respostas do Gemini (economia de tokens, pedido do dono em 08/10/2026). Uma pergunta feita DE NOVO, sem conversa anterior, com a mesma
// persona, o mesmo modelo e os mesmos trechos da base, repete a resposta guardada em vez de gastar uma chamada. Puro: o armazenamento entra por
// parâmetro (no app, o localStorage de storage.js).
//
// O que NÃO entra no cache: resposta de pergunta que dependia de conversa anterior (o chamador só consulta com histórico vazio), erro, resposta
// pronta ou falha de rede. Cada entrada vale por TTL_MS e o total fica em no máximo MAXIMO entradas (a mais antiga sai primeiro).

export const TTL_MS = 14 * 24 * 3600 * 1000;
export const MAXIMO = 40;
export const CHAVE = 'cache_respostas';

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// FNV-1a de 32 bits: basta para distinguir personas e configurações; não é segurança.
export function resumo(texto) {
  let h = 0x811c9dc5;
  const t = String(texto);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

// A chave junta tudo o que muda a resposta: personagem, persona (inclui as instruções de gesto e de base), modelo, limite de palavras,
// temperatura, os ids dos trechos da base usados e a própria pergunta normalizada.
export function chaveDaPergunta({ quemId, persona, modelo, limitePalavras = null, temperatura = null, trechos = [], pergunta }) {
  return [quemId, resumo(persona), modelo, limitePalavras ?? '', temperatura ?? '', trechos.map((t) => t.id).join(','), normalizar(pergunta)].join('|');
}

export function criarCacheRespostas({ ler, gravar, agora = () => Date.now(), ttlMs = TTL_MS, maximo = MAXIMO } = {}) {
  const carregar = () => { const v = ler(); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
  return {
    // { texto, contas } ou null
    obter(chave) {
      const e = carregar()[chave];
      if (!e || typeof e.texto !== 'string' || agora() - e.em > ttlMs) return null;
      return { texto: e.texto, contas: Array.isArray(e.contas) ? e.contas : [] };
    },
    guardar(chave, texto, contas = []) {
      if (!texto || !String(texto).trim()) return false;
      const todo = carregar();
      todo[chave] = { texto: String(texto), contas, em: agora() };
      const ordem = Object.entries(todo).sort((a, b) => b[1].em - a[1].em);
      const mantidas = Object.fromEntries(ordem.filter(([, v]) => agora() - v.em <= ttlMs).slice(0, maximo));
      return gravar(mantidas);
    },
    limpar() { return gravar({}); },
    get tamanho() { return Object.keys(carregar()).length; },
  };
}
