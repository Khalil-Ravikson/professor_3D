// Textos da interface em um lugar só (REPERTORIO 26.8). Sem travessão, sem emoji, frases curtas.
// O P5 começou este arquivo com o fluxo de sessão; os demais textos de ui.js vêm para cá no P9.
// Funções recebem o nome do personagem quando o texto depende dele.

export const T = {
  etapas: {
    atracao: {
      titulo: (nome) => `${nome} está aqui`,
      texto: 'Toque para começar uma conversa.',
      acao: 'Começar',
    },
    consentimento: {
      titulo: 'Posso ouvir você?',
      // Verdade sobre o reconhecimento de voz: no Chrome e no Edge o áudio vai ao serviço do navegador
      // para virar texto. Por isso a frase fala do totem, não de "nada sai daqui".
      texto: 'O microfone só liga quando você aperta o botão vermelho. Nada fica gravado neste totem.',
      camDesligada: 'A câmera está desligada.',
      camLigada: 'A câmera só percebe se tem alguém aqui. A imagem não é gravada nem enviada.',
      acao: 'Usar o microfone',
      alternativa: 'Prefiro escrever',
    },
    conversa: {
      mudarParaVoz: 'Usar o microfone',
    },
    despedida: {
      apagando: 'Apagando a conversa...',
    },
  },
  volume: {
    mudo: 'sem som',
    mudar: 'Desligar o som',
    religar: 'Ligar o som',
  },
  carga: {
    baixando: (nome) => `Chamando ${nome}`,
    movimentos: 'Preparando os movimentos',
  },
  licenca: {
    bloqueado: (nome) => `A licença do avatar de ${nome} não permite este uso.`,
    nenhum: 'Nenhum avatar carregado ainda.',
    decisao: { permitido: 'permitido', conferir: 'permitido, conferir', bloqueado: 'bloqueado' },
  },
  creditos: {
    titulo: 'Créditos',
    fechar: 'Fechar',
    erro: 'Não consegui ler os arquivos de créditos.',
  },
};
