// Cache dos retratos da roleta. Renderizar um .vrm de 25 MB só para tirar uma foto custa segundos,
// então cada retrato é feito uma vez e guardado no IndexedDB, com a "versão" do arquivo
// (tamanho e data) para refazer quando o .vrm mudar.
import { operar } from './banco.js';

const LOJA = 'miniaturas';

// { id, versao, url } ou null. Falha de armazenamento devolve null e deixa o motivo no console:
// sem cache o app gera o retrato de novo, só é mais lento.
export async function lerMiniatura(id, versao) {
  try {
    const r = await operar(LOJA, 'readonly', (l) => l.get(id));
    return r && r.versao === versao ? r : null;
  } catch (e) {
    console.warn(`[miniaturas] não consegui ler "${id}" do cache:`, e);
    return null;
  }
}

export async function gravarMiniatura(id, versao, url) {
  try {
    await operar(LOJA, 'readwrite', (l) => l.put({ id, versao, url, em: Date.now() }));
    return true;
  } catch (e) {
    console.warn(`[miniaturas] não consegui guardar "${id}":`, e);
    return false;
  }
}
