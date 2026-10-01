// localStorage lança exceção em modo privado, com cookies bloqueados ou cota cheia.
// Nesses casos o app segue sem lembrar preferências, e o motivo fica no console.
const PREFIXO = 'prof3d_';

export function ler(chave, padrao = '') {
  try {
    const v = localStorage.getItem(PREFIXO + chave);
    return v === null ? padrao : v;
  } catch (e) {
    console.warn(`[storage] não consegui ler "${chave}":`, e);
    return padrao;
  }
}

export function lerJSON(chave, padrao = null) {
  const bruto = ler(chave, '');
  if (!bruto) return padrao;
  try {
    return JSON.parse(bruto);
  } catch (e) {
    console.warn(`[storage] "${chave}" não é JSON válido, ignorando:`, e);
    return padrao;
  }
}

export function gravarJSON(chave, valor) {
  return gravar(chave, JSON.stringify(valor));
}

export function gravar(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, valor);
    return true;
  } catch (e) {
    console.warn(`[storage] não consegui gravar "${chave}":`, e);
    return false;
  }
}
