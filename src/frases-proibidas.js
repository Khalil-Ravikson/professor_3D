// Detector de frases proibidas nas respostas do personagem (prompt 2, R7). Puro: recebe o texto, devolve achados.
// As regras vêm das próprias instruções dos personagens (FALA_BASE e RULES em characters.js) e do PRODUCT.md:
// sem travessão, sem emoji nem markdown (a resposta é lida em voz alta), sem abertura genérica, sem repetir a
// pergunta, sem se declarar IA sem que perguntem, sem pedir dado pessoal, sem marca de controle vazando.

const ABERTURAS = [/^\s*(claro|com certeza|ótima pergunta|otima pergunta|que ótima pergunta|boa pergunta|certamente|é claro|sem problemas)\b/i];
const IA = /\b(sou uma (inteligência artificial|ia)|como (uma )?(ia|inteligência artificial|modelo de linguagem)|modelo de linguagem)\b/i;
const DADO_PESSOAL = /\b(qual (é )?(o )?(seu|teu) (nome completo|endereço|sobrenome)|em que escola (você|voce) (estuda|está)|me (diga|fale|conte) (o )?(seu )?(nome completo|endereço|telefone|escola))\b/i;
const ENCHIMENTO = /\b(espero que (isso|tenha) (ajude|ajudado)|fico feliz em ajudar|se tiver mais (alguma )?(dúvida|pergunta)s?,? (é só|me avise|pode perguntar)|estou aqui para ajudar)\b/i;
const MARCAS = /\[(gesto|emo)\b[^\]]*\]?|\b(FALA|QUADRO):/;

// ctx: { pergunta, falaMaxFrases, perguntouSeEhIA }
export function achadosProibidos(texto, ctx = {}) {
  const a = [];
  const t = String(texto || '');
  if (/[—–]/.test(t)) a.push('travessão');
  if (/\p{Extended_Pictographic}/u.test(t)) a.push('emoji');
  if (/(^|\n)\s*([-•*]|\d+[.)])\s+\S/.test(t)) a.push('lista');
  if (/[*_#`>~]/.test(t.replace(/[a-z]_[a-z]/gi, ''))) a.push('markdown');
  if (ABERTURAS.some((r) => r.test(t))) a.push('abertura genérica');
  if (!ctx.perguntouSeEhIA && IA.test(t)) a.push('declara ser IA sem perguntarem');
  if (DADO_PESSOAL.test(t)) a.push('pede dado pessoal');
  if (ENCHIMENTO.test(t)) a.push('enchimento');
  if (MARCAS.test(t)) a.push('marca de controle vazou');
  if (ctx.pergunta) {
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const p = norm(ctx.pergunta);
    if (p.length >= 12 && norm(t).startsWith(p)) a.push('repete a pergunta');
  }
  if (ctx.falaMaxFrases) {
    const frases = t.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
    if (frases.length > ctx.falaMaxFrases) a.push(`mais de ${ctx.falaMaxFrases} frases`);
  }
  return a;
}
