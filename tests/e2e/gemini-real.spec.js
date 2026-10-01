// M5 com o Gemini REAL: 10 problemas (um mal formulado). Gasta cota da sua chave.
// Precisa de GEMINI_API_KEY em .env.local; sem ela, é pulado.
// Resultado detalhado em test-results/gemini-real.json.
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

function lerChave() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (!existsSync('.env.local')) return '';
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
  return m ? m[1].trim() : '';
}
const CHAVE = lerChave();

// esperado: números aceitos na linha "Resposta"/"Recomendação" (qualquer um basta); null = deve perguntar de volta.
const PROBLEMAS = [
  { quem: 'matematico', pergunta: 'Resolva 3x + 7 = 25', esperado: ['6'] },
  { quem: 'matematico', pergunta: 'Um tênis de 240 reais está com 15% de desconto. Quanto fica?', esperado: ['204'] },
  { quem: 'matematico', pergunta: 'Um terreno retangular tem 12 m por 30 m. Qual a área?', esperado: ['360'] },
  { quem: 'matematico', pergunta: 'Quanto é 2/3 mais 3/4?', esperado: ['17/12', '1,42', '1.42', '1,417', '1.417', '1 5/12'] },
  { quem: 'matematico', pergunta: 'Um carro andou 180 km em 2 horas e meia. Qual a velocidade média?', esperado: ['72'] },
  { quem: 'matematico', pergunta: 'Qual a média das notas 7, 8,5 e 9?', esperado: ['8,17', '8.17', '8,1', '8.1', '49/6'] },
  { quem: 'matematico', pergunta: 'Quanto é 15% de 80?', esperado: ['12'] },
  { quem: 'matematico', pergunta: 'Um trem sai às três e chega quando?', esperado: null },
  { quem: 'engenheiro', pergunta: 'Quantas placas solares preciso para uma conta de 300 kWh por mês?', esperado: [] },
  { quem: 'engenheiro', pergunta: 'Qual tamanho de caixa d’água para uma casa com 4 pessoas?', esperado: [] },
];

test.describe('Gemini real', () => {
  test.skip(!CHAVE, 'sem GEMINI_API_KEY em .env.local');
  test.setTimeout(10 * 60_000);

  test('10 problemas: calcular usado, resposta certa, números conferidos', async ({ page }) => {
    const erros = [];
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
    await page.addInitScript((k) => {
      localStorage.clear();
      localStorage.setItem('prof3d_gemini_key', k);
      localStorage.setItem('prof3d_motor', 'webspeech'); // sem esperar o Kokoro: o foco aqui é o cérebro
    }, CHAVE);
    await page.goto('/?debug');
    await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar), null, { timeout: 60_000 });
    await page.evaluate(() => window.__prof3d.irParaConversa());

    const relatorio = [];
    for (const p of PROBLEMAS) {
      await page.evaluate((id) => window.__prof3d.trocarPersonagem(window.__prof3d.buscarPersonagem(id)), p.quem);
      await page.waitForFunction((id) => window.__prof3d.personagem.id === id && window.__prof3d.avatar, p.quem);
      const nHist = await page.evaluate((id) => (window.__prof3d.historicos.get(id) || []).length, p.quem);
      await page.fill('#text', p.pergunta);
      await page.click('#form button[type=submit]');
      await page.waitForFunction(({ id, n }) => {
        const h = window.__prof3d.historicos.get(id) || [];
        return (h.length >= n + 2 && h[h.length - 1].role === 'assistant') || /chave|erro|Ops|não consegui/i.test(document.getElementById('answer').textContent);
      }, { id: p.quem, n: nHist }, { timeout: 120_000 });
      const r = await page.evaluate((id) => {
        const h = window.__prof3d.historicos.get(id) || [];
        const ultima = h[h.length - 1] || {};
        const q = window.__prof3d.quadro.estado;
        return { bruto: ultima.content || '', balao: document.getElementById('answer').textContent, contas: q.contas, linhas: q.linhas };
      }, p.quem);
      const final = r.linhas.find((l) => /^(resposta|recomenda)/i.test(l.texto)) || null;
      const item = {
        pergunta: p.pergunta,
        contas: r.contas.map((c) => (c.erro ? `${c.expressao} -> erro ${c.erro}` : `${c.expressao} = ${c.resultado}`)),
        final: final ? final.texto : null,
        suspeitos: r.linhas.reduce((s, l) => s + l.suspeitos, 0),
        linhasSemConta: r.linhas.filter((l) => l.suspeitos).map((l) => l.texto),
        fala: r.balao,
      };
      if (p.esperado === null) {
        item.ok = !final && /\?/.test(r.balao);
        item.criterio = 'pede o dado que falta, sem inventar resposta';
      } else if (p.esperado.length) {
        item.ok = r.contas.length > 0 && !!final && p.esperado.some((e) => final.texto.includes(e)) && final.suspeitos === 0;
        item.criterio = `usa calcular e a resposta contém ${p.esperado.join(' ou ')}`;
      } else {
        item.ok = r.contas.length > 0 && !!final;
        item.criterio = 'usa calcular e recomenda';
      }
      relatorio.push(item);
    }
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/gemini-real.json', JSON.stringify({ erros, relatorio }, null, 2));
    const falhas = relatorio.filter((i) => !i.ok).map((i) => i.pergunta);
    expect(falhas, 'problemas que falharam (detalhes em test-results/gemini-real.json)').toEqual([]);
    expect(erros).toEqual([]);
  });
});
