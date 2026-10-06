// Cérebro: Gemini via streamGenerateContent (SSE). No M5 ganha a ferramenta
// calcular() e a separação fala/quadro.

// gemini-2.5-flash passou a ter acesso restrito a quem já o usava (docs de modelos,
// 30/09/2026); a recomendação para projetos novos é a família 3.5+.
export const MODELO_PADRAO = 'gemini-3.5-flash';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

export class ErroGemini extends Error {
  constructor(status, detalhe) {
    super(`Gemini respondeu HTTP ${status}`);
    this.name = 'ErroGemini';
    this.status = status;
    this.detalhe = detalhe;
  }
}

// Família 2.5 usa thinkingBudget (0 desliga); 3.x usa thinkingLevel e não desliga,
// "minimal" é o menor nível.
export function configDePensamento(modelo) {
  return /^gemini-2\.5/.test(modelo) ? { thinkingBudget: 0 } : { thinkingLevel: 'minimal' };
}

// Lê eventos SSE ("data: {...}" separados por linha em branco) com o texto chegando aos pedaços.
export function criarLeitorSSE(aoEvento) {
  let buf = '';
  function processar(bloco) {
    const dados = bloco.split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
      .join('\n');
    if (dados) aoEvento(JSON.parse(dados));
  }
  return {
    adicionar(pedaco) {
      buf += pedaco.replace(/\r\n?/g, '\n');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        processar(buf.slice(0, i));
        buf = buf.slice(i + 2);
      }
    },
    finalizar() {
      if (buf.trim()) processar(buf);
      buf = '';
    },
  };
}

export function textoDoEvento(evento) {
  if (evento.error) throw new ErroGemini(evento.error.code || 500, evento.error.message);
  const parts = evento?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
}

// Limite de palavras faladas -> instrução no prompt e teto de tokens com folga para o quadro.
export function instrucaoDeLimite(limitePalavras) {
  if (!limitePalavras) return '';
  return ` Limite: a parte falada da resposta tem no máximo ${limitePalavras} palavras.`;
}

// Rodadas de function calling por pergunta. O modelo às vezes pede uma conta por rodada
// (o Rafa usou 6+ no problema das placas solares); na última, as ferramentas são desligadas
// para obrigar a resposta em texto.
const MAX_RODADAS = 10;

// Uma rodada de streaming. Devolve as partes do modelo como vieram (com thoughtSignature).
async function rodada({ apiKey, modelo, corpo, signal, aoTexto, aoUso }) {
  const r = await fetch(URL_BASE + modelo + ':streamGenerateContent?alt=sse', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new ErroGemini(r.status, await r.text());
  const partes = [];
  let texto = '';
  // O usageMetadata chega repetido a cada evento, com o acumulado da rodada; vale o último.
  let uso = null;
  const leitorSSE = criarLeitorSSE((ev) => {
    const t = textoDoEvento(ev);
    for (const p of ev?.candidates?.[0]?.content?.parts || []) partes.push(p);
    if (ev.usageMetadata) uso = ev.usageMetadata;
    if (t) { texto += t; aoTexto(t); }
  });
  const leitor = r.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    leitorSSE.adicionar(value);
  }
  leitorSSE.finalizar();
  if (uso && aoUso) aoUso(uso);
  return { partes, texto };
}

// historico: [{ role: 'user' | 'assistant', content }]
// ferramentas: { nome: { declaracao, executar(args) -> objeto } }
// aoTexto(pedaco): texto conforme chega. aoChamada(nome, args, resultado): depois de cada ferramenta.
// Devolve o texto bruto de todas as rodadas (com os marcadores FALA:/QUADRO:, se houver).
export async function perguntarEmFluxo({
  apiKey, modelo = MODELO_PADRAO, persona, historico, signal, aoTexto,
  ferramentas = {}, aoChamada = () => {}, temperatura = null, limitePalavras = null,
  aoUso = null,
}) {
  const contents = historico.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const generationConfig = {
    maxOutputTokens: limitePalavras ? Math.max(512, limitePalavras * 4 + 700) : 1024,
    thinkingConfig: configDePensamento(modelo),
  };
  // Gemini 3: a Google recomenda manter 1.0; só enviamos se o usuário escolheu um valor.
  if (temperatura !== null && temperatura !== undefined) generationConfig.temperature = temperatura;
  const declaracoes = Object.values(ferramentas).map((f) => f.declaracao);

  let total = '';
  for (let i = 0; i < MAX_RODADAS; i++) {
    const corpo = {
      systemInstruction: { parts: [{ text: persona + instrucaoDeLimite(limitePalavras) }] },
      contents,
      generationConfig,
    };
    if (declaracoes.length) {
      corpo.tools = [{ functionDeclarations: declaracoes }];
      if (i === MAX_RODADAS - 1) corpo.toolConfig = { functionCallingConfig: { mode: 'NONE' } };
    }
    const { partes, texto } = await rodada({ apiKey, modelo, corpo, signal, aoTexto, aoUso });
    total += texto;
    const chamadas = partes.filter((p) => p.functionCall);
    if (!chamadas.length) break;

    // Devolve as partes do modelo exatamente como vieram (o Gemini 3 exige a thoughtSignature).
    contents.push({ role: 'model', parts: partes });
    const respostas = [];
    for (const { functionCall: fc } of chamadas) {
      const f = ferramentas[fc.name];
      const resultado = f ? f.executar(fc.args || {}) : { erro: `ferramenta desconhecida: ${fc.name}` };
      aoChamada(fc.name, fc.args || {}, resultado);
      respostas.push({ functionResponse: { name: fc.name, response: resultado, ...(fc.id ? { id: fc.id } : {}) } });
    }
    contents.push({ role: 'user', parts: respostas });
  }
  return total.trim();
}
