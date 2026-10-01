// Licença do .vrm lida dos metadados, comparada com o uso previsto do projeto.
// Módulo puro (sem DOM, sem Three): roda no navegador ao carregar o modelo e no Node em tools/licencas.mjs.
// Testado em tests/unit/licenca.test.js.
//
// Os campos mudam entre versões (inspecionados nos arquivos reais em 01/10/2026):
// - VRM 0.x (extensão "VRM"): title, author, allowedUserName (OnlyAuthor | ExplicitlyLicensedPerson | Everyone),
//   commercialUssageName (Allow | Disallow), licenseName (Redistribution_Prohibited, CC0, CC_BY..., Other),
//   otherLicenseUrl (no VRoid Hub, a URL traz as permissões na query string).
// - VRM 1.0 (extensão "VRMC_vrm"): name, authors[], avatarPermission (onlyAuthor | onlySeparatelyLicensedPerson | everyone),
//   commercialUsage (personalNonProfit | personalProfit | corporation), allowRedistribution, creditNotation, licenseUrl.

// Uso previsto: quiosque em evento público de instituição de ensino, sem fins lucrativos,
// com os arquivos num repositório público (isso é redistribuir).
export const USO_PREVISTO = {
  publico: true,          // outras pessoas além do autor usam o avatar
  institucional: true,    // quem usa é uma instituição, não uma pessoa física
  redistribui: true,      // o .vrm vai para o repositório público
};

const permitido = (motivos) => ({ decisao: motivos.bloqueio.length ? 'bloqueado' : motivos.conferir.length ? 'conferir' : 'permitido', ...motivos });

// Permissões do VRoid Hub vindas da query string de otherLicenseUrl.
function permissoesVroidHub(url) {
  try {
    const u = new URL(url);
    if (!/hub\.vroid\.com$/.test(u.hostname)) return null;
    return Object.fromEntries(u.searchParams.entries());
  } catch (e) {
    return null; // URL inválida ou ausente: tratada como "sem permissões legíveis" por quem chama
  }
}

function avaliarVrm0(m, uso) {
  const bloqueio = [], conferir = [];
  const licenca = m.licenseName || 'desconhecida';
  if (m.allowedUserName === 'OnlyAuthor' && uso.publico) bloqueio.push('só o autor pode usar este avatar');
  if (m.allowedUserName === 'ExplicitlyLicensedPerson' && uso.publico) conferir.push('só pessoas com licença explícita do autor podem usar');
  if (m.commercialUssageName === 'Disallow' && uso.institucional) conferir.push('uso comercial proibido: confirme que o evento não tem fins lucrativos');
  if (licenca === 'Redistribution_Prohibited' && uso.redistribui) bloqueio.push('redistribuição proibida: o arquivo não pode ir para o repositório público');
  if (/_ND$/.test(licenca)) conferir.push('licença sem derivações: não altere o modelo');
  if (/^CC_BY/.test(licenca)) conferir.push('exige crédito ao autor (já aparece na tela de créditos)');
  if (licenca === 'Other') {
    const hub = permissoesVroidHub(m.otherLicenseUrl);
    if (!hub) conferir.push('licença "Other" sem permissões legíveis: leia o link da licença');
    else {
      if (hub.allowed_to_use_user && hub.allowed_to_use_user !== 'everyone' && uso.publico) bloqueio.push('VRoid Hub: uso restrito a ' + hub.allowed_to_use_user);
      if (hub.redistribution === 'disallow' && uso.redistribui) bloqueio.push('VRoid Hub: redistribuição proibida');
      if (hub.corporate_commercial_use === 'disallow' && uso.institucional) conferir.push('VRoid Hub: uso por instituição/empresa não liberado');
      if (hub.credit === 'necessary') conferir.push('VRoid Hub: exige crédito (já aparece na tela de créditos)');
    }
  }
  return permitido({
    versao: '0.x', titulo: m.title || '', autor: m.author || '', licenca,
    url: m.licenseUrl || m.otherLicenseUrl || '', bloqueio, conferir,
  });
}

function avaliarVrm1(m, uso) {
  const bloqueio = [], conferir = [];
  if (m.avatarPermission === 'onlyAuthor' && uso.publico) bloqueio.push('só o autor pode usar este avatar');
  if (m.avatarPermission === 'onlySeparatelyLicensedPerson' && uso.publico) conferir.push('só pessoas com licença separada do autor podem usar');
  if (m.commercialUsage === 'personalNonProfit' && uso.institucional) conferir.push('licença só para pessoa física sem fins lucrativos');
  if (m.commercialUsage === 'personalProfit' && uso.institucional) conferir.push('licença só para pessoa física');
  if (m.allowRedistribution === false && uso.redistribui) bloqueio.push('redistribuição proibida: o arquivo não pode ir para o repositório público');
  if (m.creditNotation === 'required') conferir.push('exige crédito ao autor (já aparece na tela de créditos)');
  return permitido({
    versao: '1.0', titulo: m.name || '', autor: (m.authors || []).join(', '), licenca: m.licenseUrl || 'desconhecida',
    url: m.licenseUrl || '', bloqueio, conferir,
  });
}

// meta: vrm.meta (three-vrm) ou o objeto meta cru do glTF. versao: '0' | '1' | null (deduz pelos campos).
export function avaliarLicenca(meta, { versao = null, uso = USO_PREVISTO } = {}) {
  if (!meta) return { decisao: 'bloqueado', versao: '?', titulo: '', autor: '', licenca: 'sem metadados', url: '', bloqueio: ['o arquivo não tem metadados de licença'], conferir: [] };
  const v = versao || (meta.metaVersion === '1' || 'avatarPermission' in meta || 'authors' in meta ? '1' : '0');
  return v === '1' ? avaliarVrm1(meta, uso) : avaliarVrm0(meta, uso);
}

// Licenças de dependências que obrigam a abrir o código do app inteiro quando servido pela rede.
export function licencaDependenciaProblematica(spdx) {
  if (!spdx) return 'licença desconhecida';
  if (/AGPL/i.test(spdx)) return 'AGPL: servir pela rede obriga a publicar o código do app';
  if (/(^|[^L])GPL/i.test(spdx)) return 'GPL: confira se o uso no navegador conta como distribuição';
  return null;
}
