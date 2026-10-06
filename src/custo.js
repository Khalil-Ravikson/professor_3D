// Medidor de gasto do Gemini (REPERTORIO 23, "proteções de gasto").
// Conta os tokens que a própria API informa em `usageMetadata` e converte em reais
// com uma tabela de preços que o operador pode editar.
//
// Preços por 1 milhão de tokens, em dólares, lidos da página oficial de preços da
// API Gemini (ai.google.dev/gemini-api/docs/pricing) em 06/10/2026. Entrada de texto;
// áudio custa mais em alguns modelos e não é usado aqui.
// Modelo fora desta tabela aparece com o gasto em tokens e sem valor em reais, até o
// operador digitar o preço. Nunca chutar preço.
export const PRECOS_USD = {
  'gemini-3.5-flash': { entrada: 1.50, saida: 9.00 },
  'gemini-3.1-flash-lite': { entrada: 0.25, saida: 1.50 },
  'gemini-2.5-flash': { entrada: 0.30, saida: 2.50 },
  'gemini-2.5-flash-lite': { entrada: 0.10, saida: 0.40 },
};
export const PRECOS_FONTE = 'ai.google.dev/gemini-api/docs/pricing, consultada em 06/10/2026';

// US$ 1 em reais. REPERTORIO 23: 5,17 em 30/09/2026. Editável: câmbio muda todo dia.
export const CAMBIO_PADRAO = 5.17;

const hoje = () => new Date().toISOString().slice(0, 10);

// Normaliza "models/gemini-3.5-flash-001" e parecidos para a chave da tabela.
export function chaveDoModelo(modelo) {
  const limpo = String(modelo || '').replace(/^models\//, '').toLowerCase();
  if (PRECOS_USD[limpo]) return limpo;
  // Variantes com sufixo de data ou revisão: casa com o prefixo mais longo que existir.
  const achada = Object.keys(PRECOS_USD).filter((k) => limpo.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return achada || limpo;
}

// estadoInicial vem do localStorage; aoMudar recebe o resumo a cada soma.
export function criarMedidorDeCusto({ estadoInicial = null, cambio = CAMBIO_PADRAO, precos = null, aoMudar = () => {} } = {}) {
  const tabela = { ...PRECOS_USD, ...(precos || {}) };
  let taxa = Number(cambio) || CAMBIO_PADRAO;
  // Por dia, para o teto diário fazer sentido depois de uma noite de quiosque ligado.
  let estado = estadoInicial && estadoInicial.dia === hoje()
    ? { ...estadoInicial }
    : { dia: hoje(), entrada: 0, saida: 0, pensamento: 0, respostas: 0, porModelo: {} };
  // Sessão: zera quando o operador zera, não vira o dia.
  let sessao = { entrada: 0, saida: 0, respostas: 0 };

  function reaisDe(porModelo) {
    let usd = 0, semPreco = [];
    for (const [modelo, t] of Object.entries(porModelo)) {
      const p = tabela[chaveDoModelo(modelo)];
      if (!p) { if (t.entrada || t.saida) semPreco.push(modelo); continue; }
      // Tokens de pensamento são cobrados como saída.
      usd += (t.entrada / 1e6) * p.entrada + ((t.saida + (t.pensamento || 0)) / 1e6) * p.saida;
    }
    return { usd, reais: usd * taxa, semPreco };
  }

  function resumo() {
    const dinheiro = reaisDe(estado.porModelo);
    return {
      dia: estado.dia,
      respostas: estado.respostas,
      entrada: estado.entrada,
      saida: estado.saida,
      pensamento: estado.pensamento,
      sessao: { ...sessao },
      usd: +dinheiro.usd.toFixed(4),
      reais: +dinheiro.reais.toFixed(2),
      semPreco: dinheiro.semPreco,
      cambio: taxa,
      fonte: PRECOS_FONTE,
    };
  }

  return {
    get estado() { return { ...estado }; },
    resumo,
    precoDe(modelo) { return tabela[chaveDoModelo(modelo)] || null; },
    definirCambio(v) { taxa = Number(v) || CAMBIO_PADRAO; aoMudar(resumo()); },
    definirPreco(modelo, entrada, saida) {
      tabela[chaveDoModelo(modelo)] = { entrada: Number(entrada), saida: Number(saida) };
      aoMudar(resumo());
    },
    // uso: o objeto usageMetadata do Gemini, como vem na resposta.
    somar(modelo, uso) {
      if (!uso) return resumo();
      if (estado.dia !== hoje()) estado = { dia: hoje(), entrada: 0, saida: 0, pensamento: 0, respostas: 0, porModelo: {} };
      const entrada = uso.promptTokenCount || 0;
      const saida = uso.candidatesTokenCount || 0;
      const pensamento = uso.thoughtsTokenCount || 0;
      const m = estado.porModelo[modelo] || (estado.porModelo[modelo] = { entrada: 0, saida: 0, pensamento: 0 });
      m.entrada += entrada; m.saida += saida; m.pensamento += pensamento;
      estado.entrada += entrada; estado.saida += saida; estado.pensamento += pensamento;
      estado.respostas++;
      sessao.entrada += entrada; sessao.saida += saida; sessao.respostas++;
      const r = resumo();
      aoMudar(r);
      return r;
    },
    zerarSessao() { sessao = { entrada: 0, saida: 0, respostas: 0 }; aoMudar(resumo()); },
  };
}
