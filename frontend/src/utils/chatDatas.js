export const obterDataOrdenacaoChat = (item = {}) => (
  item.ultima_mensagem_em ||
  item.atualizada_em ||
  item.atualizado_em ||
  item.criado_em ||
  null
);

export const obterDataUltimaMensagemGrupo = (grupo = {}) => (
  grupo.ultima_mensagem_em ||
  (grupo.ultima_mensagem ? grupo.atualizado_em || grupo.atualizada_em : null)
);

const criarData = (valor) => {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const obterInicioDia = (data) => (
  new Date(data.getFullYear(), data.getMonth(), data.getDate())
);

const formatarChaveLocal = (data) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
};

const capitalizarPrimeiraLetra = (valor = '') => (
  valor ? `${valor.charAt(0).toUpperCase()}${valor.slice(1)}` : ''
);

const obterInicioSemanaAtual = (hoje) => {
  const inicioSemana = new Date(hoje);
  const diaSemana = hoje.getDay();
  const deslocamentoParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

  inicioSemana.setDate(hoje.getDate() + deslocamentoParaSegunda);
  return inicioSemana;
};

export const obterChaveDataMensagem = (valor) => {
  const data = criarData(valor);
  return data ? formatarChaveLocal(data) : '';
};

export const formatarDivisorDataMensagem = (valor) => {
  const data = criarData(valor);

  if (!data) return '';

  const agora = new Date();
  const hoje = obterInicioDia(agora);
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const diaMensagem = obterInicioDia(data);

  if (diaMensagem.getTime() === hoje.getTime()) {
    return 'Hoje';
  }

  if (diaMensagem.getTime() === ontem.getTime()) {
    return 'Ontem';
  }

  const inicioSemanaAtual = obterInicioSemanaAtual(hoje);

  if (
    diaMensagem.getTime() >= inicioSemanaAtual.getTime() &&
    diaMensagem.getTime() < hoje.getTime()
  ) {
    return capitalizarPrimeiraLetra(data.toLocaleDateString('pt-BR', {
      weekday: 'long',
    }));
  }

  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatarDataHoraListaChat = (valor) => {
  if (!valor) return '';

  const data = criarData(valor);
  if (!data) return '';

  const agora = new Date();
  const hoje = obterInicioDia(agora);
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const diaMensagem = obterInicioDia(data);

  const hora = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (diaMensagem.getTime() === hoje.getTime()) {
    return hora;
  }

  if (diaMensagem.getTime() === ontem.getTime()) {
    // Rollback simples: antes exibia `Ontem ${hora}` na lista.
    return 'Ontem';
  }

  const diaMes = data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  return `${diaMes} ${hora}`;
};
