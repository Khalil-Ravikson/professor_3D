// Núcleo do laboratório de vozes (prompt 3, U4). Puro: sem navegador, testável.
// Frases fixas, ordem aleatória sem rótulo, resumo por voz e recomendação por LIMIARES escritos aqui e mostrados ao operador.
// A decisão sai dos números (notas cegas, tempo, estabilidade, custo), não do gosto de quem programou.

// 13 frases. Nenhuma afirma fato sobre a UEMA: só põem nomes, números e entonações à prova. `nomes: true` entra na nota
// de pronúncia dos nomes; `numeros: true` serve para ver como cada motor lê dígitos.
export const FRASES_LAB = [
  { id: 'f01', texto: 'Oi! Eu sou a Luma. Esta é a minha voz.' },
  { id: 'f02', texto: 'Maranhão, UEMA, Imperatriz e Caxias são nomes difíceis de falar.', nomes: true },
  { id: 'f03', texto: 'A UEMASUL e a FESM também aparecem nesta lista de siglas.', nomes: true },
  { id: 'f04', texto: 'Vamos treinar a leitura destas palavras em latim: Scientia ad Vitam.', nomes: true },
  { id: 'f05', texto: 'Hoje é 12 de outubro de 2026, e a conta é 7 vezes 8, que dá 56.', numeros: true },
  { id: 'f06', texto: 'Você sabia que o céu é azul por causa da luz do sol?' },
  { id: 'f07', texto: 'Que legal! Vamos fazer uma conta juntos!' },
  { id: 'f08', texto: 'Para somar frações, primeiro a gente precisa de um denominador comum. Depois é só somar os numeradores e guardar o denominador. Quer tentar com dois terços e três quartos? Eu te ajudo em cada passo, sem pressa.' },
  { id: 'f09', texto: 'Calma, vamos com calma. Eu te ajudo em cada passo.' },
  { id: 'f10', texto: 'Dois terços mais três quartos dá dezessete doze avos.', numeros: true },
  { id: 'f11', texto: 'Não entendi muito bem. Pode repetir de outro jeito?' },
  { id: 'f12', texto: 'Parabéns! Você acertou todas as perguntas!' },
  { id: 'f13', texto: 'Eu ainda estou aprendendo, e errar também faz parte de aprender.' },
];
export const CRITERIOS = [
  { id: 'naturalidade', nome: 'Naturalidade' },
  { id: 'clareza', nome: 'Clareza' },
  { id: 'pronuncia', nome: 'Pronúncia dos nomes', so: 'nomes' }, // só se avalia nas frases com nomes
];
// Frase repetida para medir estabilidade (duas gerações da mesma frase).
export const FRASE_ESTABILIDADE = 'f01';

export const LIMIARES_PADRAO = {
  notaMinimaAoVivo: 3.5,   // média das notas para a voz poder ser a voz "ao vivo"
  tempoMaxAoVivoMs: 2500,  // mediana do tempo até o áudio completo de uma frase
  estabilidadeMaxPct: 15,  // diferença de duração entre duas gerações da mesma frase
  notaMinimaReserva: 3.0,
  falhasMaxPct: 20,
};

// Embaralha (Fisher-Yates) com gerador injetável, para teste ser determinístico.
export function embaralhar(lista, aleatorio = Math.random) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(aleatorio() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Amostras = uma por (voz x frase). `codigo` é o que o avaliador vê; a ligação com a voz só existe aqui, no operador.
export function montarAmostras(vozes, frases = FRASES_LAB, aleatorio = Math.random) {
  const todas = [];
  for (const v of vozes) for (const f of frases) todas.push({ vozId: v.id, fraseId: f.id });
  return embaralhar(todas, aleatorio).map((a, i) => ({ ...a, codigo: `#${String(i + 1).padStart(2, '0')}` }));
}

const media = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const mediana = (xs) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const estatistica = { media, mediana };

// medicoes: [{ vozId, fraseId, ok, ms, msCabecalho, duracao, caracteres, usd, repeticao? }]  (repeticao: 2 = segunda geração)
// notas: [{ vozId, fraseId, naturalidade, clareza, pronuncia? }]   (1 a 5)
export function resumirVoz(vozId, medicoes, notas, frases = FRASES_LAB) {
  const m = medicoes.filter((x) => x.vozId === vozId);
  const principais = m.filter((x) => !x.repeticao);
  const boas = principais.filter((x) => x.ok);
  const n = notas.filter((x) => x.vozId === vozId);
  const nomes = new Set(frases.filter((f) => f.nomes).map((f) => f.id));
  const media3 = (k) => media(n.map((x) => x[k]).filter((v) => Number.isFinite(v)));
  const naturalidade = media3('naturalidade'), clareza = media3('clareza');
  const pronuncia = media(n.filter((x) => nomes.has(x.fraseId)).map((x) => x.pronuncia).filter((v) => Number.isFinite(v)));
  const nota = media([naturalidade, clareza, pronuncia].filter((v) => v !== null));
  // Estabilidade: duas gerações da frase de teste.
  let estabilidadePct = null;
  const a = boas.find((x) => x.fraseId === FRASE_ESTABILIDADE), b = m.find((x) => x.repeticao === 2 && x.ok && x.fraseId === FRASE_ESTABILIDADE);
  if (a && b && a.duracao > 0) estabilidadePct = (Math.abs(b.duracao - a.duracao) / a.duracao) * 100;
  const caracteres = boas.reduce((s, x) => s + (x.caracteres || 0), 0);
  const usd = boas.reduce((s, x) => s + (x.usd || 0), 0);
  return {
    vozId,
    amostras: principais.length,
    falhasPct: principais.length ? ((principais.length - boas.length) / principais.length) * 100 : null,
    naturalidade, clareza, pronuncia, nota,
    avaliadas: n.length,
    tempoMedianaMs: mediana(boas.map((x) => x.ms)),
    tempoCabecalhoMedianaMs: mediana(boas.map((x) => x.msCabecalho).filter((v) => Number.isFinite(v))),
    estabilidadePct,
    usdPorMilCaracteres: caracteres ? (usd / caracteres) * 1000 : null,
  };
}

// Papel de cada voz, só a partir dos números. Devolve { papel, motivos }.
//  ao vivo: nota >= limiar, rápida, estável e sem falhas;  pré-gravada: boa nota mas lenta, instável ou sem tempo medido;
//  reserva: nota intermediária;  desligada: nota baixa ou muitas falhas;  sem dados: ainda não foi avaliada.
export function recomendar(r, lim = LIMIARES_PADRAO) {
  const motivos = [];
  if (r.nota === null) return { papel: 'sem dados', motivos: ['ainda sem notas'] };
  if (r.falhasPct !== null && r.falhasPct > lim.falhasMaxPct) return { papel: 'desligada', motivos: [`falhou em ${r.falhasPct.toFixed(0)}% das frases (limite ${lim.falhasMaxPct}%)`] };
  if (r.nota < lim.notaMinimaReserva) return { papel: 'desligada', motivos: [`nota média ${r.nota.toFixed(2)} abaixo de ${lim.notaMinimaReserva}`] };
  if (r.nota < lim.notaMinimaAoVivo) return { papel: 'reserva', motivos: [`nota média ${r.nota.toFixed(2)} entre ${lim.notaMinimaReserva} e ${lim.notaMinimaAoVivo}`] };
  const lento = r.tempoMedianaMs !== null && r.tempoMedianaMs > lim.tempoMaxAoVivoMs;
  const instavel = r.estabilidadePct !== null && r.estabilidadePct > lim.estabilidadeMaxPct;
  if (lento) motivos.push(`mediana de ${Math.round(r.tempoMedianaMs)} ms, acima de ${lim.tempoMaxAoVivoMs} ms`);
  if (instavel) motivos.push(`duração varia ${r.estabilidadePct.toFixed(0)}% entre duas gerações, acima de ${lim.estabilidadeMaxPct}%`);
  if (r.estabilidadePct === null) motivos.push('estabilidade não medida');
  if (lento || instavel) return { papel: 'pré-gravada', motivos: [`nota ${r.nota.toFixed(2)}`, ...motivos] };
  return { papel: 'ao vivo', motivos: [`nota ${r.nota.toFixed(2)}`, `mediana ${Math.round(r.tempoMedianaMs ?? 0)} ms`, ...(r.estabilidadePct === null ? motivos : [])] };
}

const f1 = (v) => (v === null || v === undefined ? 'n/d' : v.toFixed(2));
const fms = (v) => (v === null ? 'n/d' : `${Math.round(v)} ms`);

// Relatório em Markdown. vozes: [{ id, nome, motor, observacao? }]; cambio: reais por dólar.
export function gerarRelatorio({ vozes, medicoes, notas, limiares = LIMIARES_PADRAO, cambio = 5.17, data = new Date().toISOString().slice(0, 10), fontePrecos = '' }) {
  const linhas = [`# Laboratório de vozes, ${data}`, '', `Notas cegas de 1 a 5, ${notas.length} avaliações. Câmbio R$ ${cambio} por dólar. ${fontePrecos}`.trim(), ''];
  linhas.push('| Voz | Motor | Naturalidade | Clareza | Pronúncia dos nomes | Nota | Tempo (mediana) | Estabilidade | R$ por 1.000 caracteres | Falhas | Papel |');
  linhas.push('|---|---|---|---|---|---|---|---|---|---|---|');
  const rec = [];
  for (const v of vozes) {
    const r = resumirVoz(v.id, medicoes, notas);
    const p = recomendar(r, limiares);
    rec.push({ v, r, p });
    const reais = r.usdPorMilCaracteres === null ? 'n/d' : (r.usdPorMilCaracteres * cambio).toFixed(2);
    linhas.push(`| ${v.nome} | ${v.motor} | ${f1(r.naturalidade)} | ${f1(r.clareza)} | ${f1(r.pronuncia)} | ${f1(r.nota)} | ${fms(r.tempoMedianaMs)} | ${r.estabilidadePct === null ? 'n/d' : r.estabilidadePct.toFixed(0) + '%'} | ${reais} | ${r.falhasPct === null ? 'n/d' : r.falhasPct.toFixed(0) + '%'} | **${p.papel}** |`);
  }
  linhas.push('', '## Recomendação por papel', '');
  for (const { v, p } of rec) linhas.push(`- **${v.nome}**: ${p.papel}. ${p.motivos.join('; ')}.`);
  linhas.push('', '## Regras usadas (editáveis na página)', '',
    `- ao vivo: nota média de ${limiares.notaMinimaAoVivo} ou mais, mediana de tempo de até ${limiares.tempoMaxAoVivoMs} ms, duração que varia até ${limiares.estabilidadeMaxPct}% entre duas gerações e no máximo ${limiares.falhasMaxPct}% de falhas;`,
    `- pré-gravada: nota boa, mas lenta ou instável;`,
    `- reserva: nota de ${limiares.notaMinimaReserva} a ${limiares.notaMinimaAoVivo};`,
    `- desligada: nota abaixo de ${limiares.notaMinimaReserva} ou falhas acima do limite.`, '',
    'O tempo medido é do pedido até o áudio completo decodificado (os motores usados aqui não transmitem por pedaços), não até o primeiro som.');
  return linhas.join('\n') + '\n';
}
