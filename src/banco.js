// Banco local do navegador (IndexedDB). Um módulo só abre o banco, porque duas partes do app
// abrindo "prof3d" em versões diferentes dão VersionError e deixam uma delas sem armazenamento.
//
// Lojas:
//   movimentos  : arquivos .fbx e .vrma enviados pelo operador (src/movimentos.js)
//   miniaturas  : retratos renderizados dos .vrm, para a roleta de seleção (src/miniaturas.js)
//
// Versão 2 (P11/fase 5) acrescentou "miniaturas". Subir a versão é seguro: a loja antiga não é tocada.
export const BANCO = 'prof3d';
export const VERSAO_BANCO = 2;
export const LOJAS = { movimentos: 'id', miniaturas: 'id' };

export function abrirBanco() {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, VERSAO_BANCO);
    req.onupgradeneeded = () => {
      for (const [nome, chave] of Object.entries(LOJAS)) {
        if (!req.result.objectStoreNames.contains(nome)) req.result.createObjectStore(nome, { keyPath: chave });
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
    req.onblocked = () => falha(new Error('o banco está aberto em outra aba numa versão antiga'));
  });
}

// Executa uma operação numa loja e espera a transação terminar.
export async function operar(loja, modo, fn) {
  const db = await abrirBanco();
  try {
    return await new Promise((ok, falha) => {
      const tx = db.transaction(loja, modo);
      const req = fn(tx.objectStore(loja));
      tx.oncomplete = () => ok(req && req.result);
      tx.onerror = () => falha(tx.error);
      tx.onabort = () => falha(tx.error || new Error('transação abortada (cota cheia?)'));
    });
  } finally {
    db.close();
  }
}
