// Léxico de pronúncia POR MOTOR (prompt 3, U4). Substituição de texto antes de sintetizar: "UEMASUL" -> "Uema Sul".
// Escolhi substituição de texto (alias) porque funciona igual em qualquer motor. O ElevenLabs também tem dicionários de
// pronúncia próprios (POST /v1/pronunciation-dictionaries/add-from-rules, regras alias ou phoneme, até 3 por pedido), mas a
// página da API não diz quais modelos aceitam regra de fonema nem em quais idiomas, então não dependo disso.
// O léxico é DADO do operador (assets/lexico-pronuncia.json): cada entrada diz o que trocar, por quê, e se já foi ouvida no
// laboratório de vozes. Nada aqui afirma como um motor pronuncia: quem decide é o ouvido, no laboratório.
//
// Formato: { entradas: [ { de, para, motores?: ['kokoro-server', ...], palavraInteira?: true, validado?: false } ] }
// `motores` ausente = todos os motores. A ordem das entradas é a ordem de aplicação.

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function aplicarLexico(texto, motorId, lexico) {
  const entradas = lexico && Array.isArray(lexico.entradas) ? lexico.entradas : [];
  let s = String(texto);
  for (const e of entradas) {
    if (!e || !e.de || typeof e.para !== 'string') continue;
    if (Array.isArray(e.motores) && e.motores.length && !e.motores.includes(motorId)) continue;
    const corpo = escapar(e.de);
    // Letras acentuadas contam como letra: \b não serve em JS para "Maranhão".
    const re = e.palavraInteira === false ? new RegExp(corpo, 'gu') : new RegExp(`(?<![\\p{L}\\p{N}])${corpo}(?![\\p{L}\\p{N}])`, 'gu');
    s = s.replace(re, e.para);
  }
  return s;
}

// Confere o arquivo do operador. Devolve a lista de problemas (vazia = ok).
export function validarLexico(lexico) {
  const erros = [];
  if (!lexico || !Array.isArray(lexico.entradas)) return ['faltam "entradas"'];
  lexico.entradas.forEach((e, i) => {
    if (!e || typeof e.de !== 'string' || !e.de.trim()) erros.push(`entrada ${i + 1}: falta "de"`);
    else if (typeof e.para !== 'string') erros.push(`entrada ${i + 1} (${e.de}): falta "para"`);
    else if (e.para.includes('—')) erros.push(`entrada ${i + 1} (${e.de}): travessão no texto falado`);
  });
  return erros;
}
