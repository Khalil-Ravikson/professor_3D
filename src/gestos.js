// Diretor de gestos: decide QUAL clipe toca e QUANDO. Não toca nada (isso é do avatar.js).
// Módulo puro, sem DOM nem Three: testado em tests/unit/gestos.test.js.
//
// Regras (REPERTORIO 25.4):
// - Só usa clipe com status "ativo" no catálogo; no modo infantil, só infantilOk; no modo calmo, só intensidade 1.
// - Estado sem clipe cai para o idle; gesto sem clipe é ignorado. Os dois ficam no registro.
// - Gesto pedido durante a fala espera a fronteira da próxima sentença (nunca começa no meio de uma).
// - O mesmo gesto não repete duas vezes seguidas, e há um intervalo mínimo entre o fim de um gesto e o próximo.
//   Gestos do fluxo (cumprimento, despedida) passam por cima do intervalo.

export const ESTADOS_BASE = ['idle', 'listening', 'thinking', 'talking'];

export function criarDiretor({
  clipes,                       // registros do catálogo já com as escolhas do operador
  mapa,                         // estado ou gesto -> id de clipe ou lista de ids (catalogo.estados)
  inventario = null,            // gestos que este personagem pode fazer; null = todos do mapa
  intervaloMinS = 8,
  agora = () => performance.now() / 1000,
  calmo = () => false,
  infantil = () => false,
  registrar = (msg) => console.info('[gestos] ' + msg),
}) {
  const porId = new Map(clipes.map((c) => [c.id, c]));
  let ultimoGesto = null, tUltimo = -Infinity, pendente = null, emCurso = false;
  const usados = new Map(); // gesto -> último id de clipe usado (para alternar entre opções)

  function utilizavel(c) {
    if (!c || c.status !== 'ativo') return false;
    if (infantil() && !c.infantilOk) return false;
    if (calmo() && c.intensidade > 1) return false;
    return true;
  }

  function opcoes(nome) {
    const v = mapa[nome];
    const ids = v == null ? [] : Array.isArray(v) ? v : [v];
    return ids.map((id) => porId.get(id)).filter(utilizavel);
  }

  function gestosValidos() {
    return Object.keys(mapa)
      .filter((g) => !ESTADOS_BASE.includes(g))
      .filter((g) => !inventario || inventario.includes(g))
      .filter((g) => opcoes(g).length > 0);
  }

  // Clipe de um estado-base; sem clipe próprio, o do idle; sem idle, null (pose do arquivo).
  function clipeBase(estado) {
    const [c] = opcoes(estado);
    if (c) return c;
    if (estado !== 'idle') return clipeBase('idle');
    return null;
  }

  function escolher(gesto) {
    const ops = opcoes(gesto);
    if (ops.length <= 1) return ops[0] || null;
    const anterior = usados.get(gesto);
    const c = ops.find((o) => o.id !== anterior) || ops[0];
    return c;
  }

  // origem: 'fluxo' (cumprimento/despedida), 'llm', 'evento' (quiz, erro), 'operador'.
  // falando: se há uma sentença tocando agora. Devolve { clipe } para tocar já, { esperando } ou { ignorado }.
  function pedir(gesto, { origem = 'evento', falando = false } = {}) {
    if (inventario && !inventario.includes(gesto) && origem !== 'operador') {
      registrar(`ignorado: "${gesto}" (${origem}) não está no inventário do personagem`);
      return { ignorado: 'inventario' };
    }
    if (!(gesto in mapa)) {
      registrar(`ignorado: "${gesto}" (${origem}) não existe`);
      return { ignorado: 'inexistente' };
    }
    if (ESTADOS_BASE.includes(gesto)) {
      registrar(`ignorado: "${gesto}" (${origem}) é estado, não gesto`);
      return { ignorado: 'estado' };
    }
    const c = escolher(gesto);
    if (!c) {
      registrar(`ignorado: "${gesto}" (${origem}) sem clipe ativo${calmo() ? ' (modo calmo)' : ''}`);
      return { ignorado: 'sem-clipe' };
    }
    const fluxo = origem === 'fluxo' || origem === 'operador';
    if (!fluxo && gesto === ultimoGesto) {
      registrar(`ignorado: "${gesto}" repetiria o gesto anterior`);
      return { ignorado: 'repetido' };
    }
    if (!fluxo && emCurso) {
      registrar(`ignorado: "${gesto}" durante outro gesto`);
      return { ignorado: 'ocupado' };
    }
    if (!fluxo && agora() - tUltimo < intervaloMinS) {
      registrar(`ignorado: "${gesto}" antes do intervalo mínimo de ${intervaloMinS} s`);
      return { ignorado: 'intervalo' };
    }
    if (falando) {
      pendente = { gesto, clipe: c };
      return { esperando: true };
    }
    return { clipe: confirmar(gesto, c) };
  }

  function confirmar(gesto, c) {
    ultimoGesto = gesto; tUltimo = agora(); usados.set(gesto, c.id); emCurso = true;
    return c;
  }

  // O avatar avisa quando o gesto acabou: o intervalo mínimo conta a partir daqui.
  function terminou() { emCurso = false; tUltimo = agora(); }

  // Chamado no fim de cada sentença falada e quando a fala acaba: libera o gesto que esperava.
  function fronteira() {
    if (!pendente) return null;
    const { gesto, clipe } = pendente;
    pendente = null;
    return confirmar(gesto, clipe);
  }

  function cancelarPendente() { pendente = null; }

  return { clipeBase, clipesDe: opcoes, pedir, fronteira, cancelarPendente, terminou, gestosValidos, get pendente() { return pendente && pendente.gesto; } };
}

// Marcas de gesto do LLM no texto: [gesto:comemora]. A marca viaja junto com a sentença até a voz,
// que a tira antes de sintetizar e avisa quando aquela sentença começa a tocar (a fronteira).
const MARCA = /\[gesto:\s*([a-z0-9-]+)\s*\]\s*/gi;
export function extrairGestos(texto) {
  const gestos = [];
  const limpo = texto.replace(MARCA, (_, nome) => { gestos.push(nome.toLowerCase()); return ''; });
  return { texto: limpo, gestos };
}
// Para mostrar na tela: tira marcas completas e uma marca ainda incompleta no fim do texto.
export function removerMarcas(texto) {
  return texto.replace(MARCA, '').replace(/\[(g(e(s(t(o(:[a-z0-9-]*)?)?)?)?)?)?$/i, '');
}

// Instrução para o LLM, só com os gestos que existem e estão ativos agora.
export function instrucaoGestos(validos) {
  if (!validos.length) return '';
  return ` Gestos: se combinar com a resposta, escreva no máximo uma marca [gesto:nome] no começo de uma frase. ` +
    `Nomes válidos: ${validos.join(', ')}. Não invente outros nomes e não fale a marca.`;
}
