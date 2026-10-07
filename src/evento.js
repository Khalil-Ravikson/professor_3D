// Modo evento (prompt 3, U6): política de sessão e textos da fila. Puro: sem navegador, testável.
// Política: limite de turnos (perguntas) e de tempo por sessão. 0 = sem limite. Ao chegar a um limite, a sessão termina com a
// despedida normal (o app chama encerrarSessao). O tempo só conta depois do primeiro turno ou do início explícito.

export function criarPoliticaSessao({ maxTurnos = 0, maxSegundos = 0, agora = () => Date.now() } = {}) {
  let turnos = 0, inicio = null;
  return {
    configurar(turnosMax, segundosMax) { maxTurnos = Math.max(0, Number(turnosMax) || 0); maxSegundos = Math.max(0, Number(segundosMax) || 0); },
    iniciar() { turnos = 0; inicio = agora(); },
    parar() { turnos = 0; inicio = null; },
    contarTurno() { if (inicio === null) inicio = agora(); turnos++; },
    estado() {
      const seg = inicio === null ? 0 : (agora() - inicio) / 1000;
      let motivo = null;
      if (maxTurnos && turnos >= maxTurnos) motivo = 'turnos';
      else if (maxSegundos && seg >= maxSegundos) motivo = 'tempo';
      return {
        turnos, segundos: Math.floor(seg), motivo,
        turnosRestantes: maxTurnos ? Math.max(0, maxTurnos - turnos) : null,
        segundosRestantes: maxSegundos ? Math.max(0, Math.ceil(maxSegundos - seg)) : null,
      };
    },
  };
}

// Itens da demonstração guiada que o dono aprovou. Sem aprovação nenhum aparece: o app não inventa resposta.
export function itensAprovados(lista) {
  return (Array.isArray(lista) ? lista : []).filter((i) => i && i.pergunta && i.resposta && i.aprovado !== false);
}
