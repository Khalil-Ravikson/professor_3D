// Foto e vídeo do avatar (prompt 7, V4): só liberam se a licença do .vrm E a do clipe em uso permitirem o uso previsto, e mostram o crédito exigido.
// Puro: sem DOM nem Three. Recebe o resultado de avaliarLicenca (src/licenca.js) e o clipe do catálogo (animacoes.json).
// Interpretação (NÃO é parecer jurídico; o dono confirma): "proibido distribuir o arquivo solto" (Mixamo) e "proibido redistribuir" (pacote VRoid)
// falam do ARQUIVO do clipe, não de uma foto ou vídeo que o mostra em uso; por isso não bloqueiam. Só bloqueia texto que proíba o USO ou a
// reprodução do resultado. Clipe sem licença escrita no catálogo vira "conferir".

const PROIBE_USO = /(uso|reprodu[cç][aã]o|publica[cç][aã]o)\s+(n[aã]o permitid[oa]|proibid[oa]|vedad[oa])|(proibid[oa]|vedad[oa])\s+(o\s+)?(uso|filmar|fotografar|gravar)/i;

export function avaliarCaptura({ modelo, clipe, confirmouModelo = false, confirmouClipe = false } = {}) {
  const motivos = [], conferir = [];
  if (!modelo) motivos.push('a licença do modelo não foi lida');
  else if (modelo.decisao === 'bloqueado') motivos.push(...(modelo.bloqueio && modelo.bloqueio.length ? modelo.bloqueio : ['o modelo está bloqueado pela licença']));
  else if (modelo.decisao === 'conferir' && !confirmouModelo) conferir.push(...(modelo.conferir || []).map((c) => `modelo: ${c}`));
  if (clipe) {
    const lic = (clipe.licenca || '').trim();
    if (!lic) { if (!confirmouClipe) conferir.push(`clipe "${clipe.id}": o catálogo não traz a licença`); }
    else if (PROIBE_USO.test(lic)) motivos.push(`clipe "${clipe.id}": ${lic}`);
  }
  const ok = motivos.length === 0 && conferir.length === 0;
  return { ok, motivos, conferir, credito: ok || conferir.length ? montarCredito(modelo, clipe) : '' };
}

export function montarCredito(modelo, clipe) {
  const partes = [];
  if (modelo && (modelo.titulo || modelo.autor)) partes.push(`Modelo: ${modelo.titulo || 'sem título'}${modelo.autor ? `, ${modelo.autor}` : ''}${modelo.licenca ? ` (${modelo.licenca})` : ''}`);
  if (clipe && clipe.id !== 'idle') partes.push(`Animação: ${clipe.origem || clipe.id}`);
  else if (clipe && clipe.origem) partes.push(`Animação: ${clipe.origem}`);
  return partes.join('. ');
}
