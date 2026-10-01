// calcular(expressao): a única fonte de números das contas do Teo e do Rafa.
// mathjs não usa eval; mesmo assim seguimos a receita de segurança da documentação
// (mathjs.org/docs/expressions/security.html) e bloqueamos import, parse etc.
import { create, all } from 'mathjs';

const math = create(all);
const avaliar = math.evaluate;
const bloquear = (nome) => function () { throw new Error(`função ${nome} desativada`); };
math.import({
  import: bloquear('import'),
  createUnit: bloquear('createUnit'),
  reviver: bloquear('reviver'),
  evaluate: bloquear('evaluate'),
  parse: bloquear('parse'),
  simplify: bloquear('simplify'),
  derivative: bloquear('derivative'),
  resolve: bloquear('resolve'),
}, { override: true });

const MAX_CARACTERES = 200;

function normalizar(expr) {
  return expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
}

// Vírgula decimal brasileira ("3,5"): só se a expressão original falhar, para não
// estragar argumentos como fraction(2,3).
function avaliarComVirgula(expr) {
  try {
    return avaliar(expr);
  } catch (e) {
    if (!/\d,\d/.test(expr)) throw e;
    return avaliar(expr.replace(/(\d),(\d)/g, '$1.$2'));
  }
}

// Devolve { expressao, resultado (texto), valor (número, se houver) } ou { expressao, erro }.
export function calcular(expressao) {
  const bruta = String(expressao ?? '').trim();
  if (!bruta) return { expressao: bruta, erro: 'expressão vazia' };
  if (bruta.length > MAX_CARACTERES) return { expressao: bruta, erro: `expressão maior que ${MAX_CARACTERES} caracteres` };
  try {
    const r = avaliarComVirgula(normalizar(bruta));
    const tipo = math.typeOf(r);
    if (tipo === 'function' || tipo === 'undefined' || tipo === 'ResultSet') return { expressao: bruta, erro: 'a expressão não produziu um valor' };
    const resultado = math.format(r, { precision: 12 });
    let valor = null;
    if (tipo === 'number') valor = r;
    else if (tipo === 'Fraction' || tipo === 'BigNumber') valor = math.number(r);
    else if (tipo === 'Unit') valor = r.toNumber();
    if (valor !== null && !Number.isFinite(valor)) return { expressao: bruta, erro: 'resultado não é finito' };
    return { expressao: bruta, resultado, valor };
  } catch (e) {
    return { expressao: bruta, erro: e.message };
  }
}

// Declaração para o Gemini (function calling da API generateContent, v1beta).
export const DECLARACAO_CALCULAR = {
  name: 'calcular',
  description:
    'Calcula uma expressão matemática com precisão. Use para TODA conta, inclusive as simples. ' +
    'Sintaxe mathjs: + - * / ^, parênteses, sqrt(), %, frações com fraction(2,3), unidades como "12 m * 30 m". ' +
    'Use ponto como separador decimal. Quando já souber várias contas, peça todas de uma vez (várias chamadas na mesma resposta).',
  parameters: {
    type: 'OBJECT',
    properties: { expressao: { type: 'STRING', description: 'A expressão, por exemplo "(25 - 7) / 3"' } },
    required: ['expressao'],
  },
};
