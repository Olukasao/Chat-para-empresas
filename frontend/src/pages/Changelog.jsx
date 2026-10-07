import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const changelogItems = [
  {
    titulo: "Falhas Gerais no acesso rápido",
    data: "01/07/2026",
    versao: "v1.27",
    autor: "Lucas Soares",
    descricao: [
      "Criada a área Falhas Gerais com sites úteis para status, rotas, DNS, e-mail e testes de conexão.",
      "Adicionados destaques principais e grupos por Falhas gerais, Diagnóstico cliente, NOC avançado e DNS/E-mail.",
      "Incluída busca para filtrar rapidamente por termos como DNS, BGP, Google, WhatsApp e e-mail.",
    ],
  },
  {
    titulo: "Plantão de domingo por setor",
    data: "25/05/2026",
    versao: "v1.26",
    autor: "Lucas Soares",
    descricao: [
      "Criada página de Plantão de Domingo com atalho em Acessos rápidos da Home.",
      "Escala passou a ser organizada por setores: NOC, Rede, Cliente e Terceiros.",
      "Editor do plantão foi reorganizado por setor, com campos maiores e botão para adicionar pessoas em cada equipe.",
    ],
  },
  {
    titulo: "Exclusão de feedbacks no admin",
    data: "22/05/2026",
    versao: "v1.25",
    autor: "Lucas Soares",
    descricao: [
      "Painel administrativo ganhou ação para excluir bugs e sugestões recebidos.",
      "Exclusão pede confirmação antes de remover o feedback da lista.",
      "Backend passou a validar a exclusão por administrador e empresa.",
    ],
  },
  {
    titulo: "Responsável por feedback resolvido",
    data: "22/05/2026",
    versao: "v1.24",
    autor: "Lucas Soares",
    descricao: [
      "Painel administrativo ganhou seleção de quem resolveu cada bug ou sugestão recebida.",
      "Feedbacks resolvidos passam a registrar responsável e data de resolução no banco.",
      "Página de Changelog agora mostra quem resolveu cada bug ou melhoria publicada.",
    ],
  },
  {
    titulo: "Notas Rápidas compartilhadas",
    data: "22/05/2026",
    versao: "v1.23",
    autor: "Lucas Soares",
    descricao: [
      "Adicionado compartilhamento de Notas Rápidas com uma ou mais pessoas do sistema.",
      "Notas compartilhadas passaram a aparecer para os usuários selecionados com identificação visual discreta.",
      "Permissões mantêm edição, exclusão e alteração de compartilhamentos apenas para o dono da nota.",
    ],
  },
  {
    titulo: "Leitura de notas compartilhadas",
    data: "22/05/2026",
    versao: "v1.22",
    autor: "Lucas Soares",
    descricao: [
      "Adicionado botão “Abrir” para visualizar o conteúdo completo das notas.",
      "Usuários com notas compartilhadas podem abrir e copiar o conteúdo sem editar ou excluir.",
      "Criado modal de leitura com dados de criação, edição e pessoas com acesso.",
    ],
  },
  {
    titulo: "Home da Intranet",
    data: "22/05/2026",
    versao: "v1.21",
    autor: "Lucas Soares",
    descricao: [
      "Título da Home ajustado para “Intranet Dias Gestão” com animação de entrada.",
      "Título da Intranet e botão “Ver avisos internos” foram alinhados em cantos separados acima do banner.",
      "Corrigido o menu da Agenda em Acessos rápidos para abrir acima do painel do Grafana.",
    ],
  },
  {
    titulo: "Ícones dos grupos por setor",
    data: "22/05/2026",
    versao: "v1.20",
    autor: "Lucas Soares",
    descricao: [
      "Ícones dos grupos passaram a variar conforme o nome ou setor do grupo.",
      "Adicionados ícones específicos para áreas como NOC, Marketing, Comercial, Financeiro, RH e Suporte.",
      "Corrigida a prioridade dos ícones para diferenciar Marketing/Redes Sociais/Design de NOC.",
    ],
  },
  {
    titulo: "Changelog com correções resolvidas",
    data: "22/05/2026",
    versao: "v1.19",
    autor: "Lucas Soares",
    descricao: [
      "Criada seção “Correções e feedbacks resolvidos” dentro da aba de Changelog.",
      "Feedbacks resolvidos passaram a aparecer sem exibir o nome de quem reportou.",
      "Itens do changelog ganharam identificação visual para diferenciar atualizações de correções.",
    ],
  },
  {
    titulo: "Notas Rápidas pessoais",
    data: "22/05/2026",
    versao: "v1.18",
    autor: "Lucas Soares",
    descricao: [
      "Adicionado atalho “Notas Rápidas” na área de acessos rápidos do Chat Interno NOC.",
      "Criada tela pessoal para criar, editar, excluir, fixar, copiar e buscar notas do dia a dia.",
      "Backend passou a salvar as notas vinculadas ao usuário logado, impedindo acesso a notas de outros usuários.",
    ],
  },
  {
    titulo: "Correção no anexo de áudio",
    data: "22/05/2026",
    versao: "v1.17",
    autor: "Lucas Soares",
    descricao: [
      "Corrigido problema em que o áudio selecionado podia não anexar em alguns navegadores.",
      "Ampliado suporte para MP3, M4A, OGG, OPUS, WEBM, AAC, AMR e outros formatos comuns.",
      "Backend passou a aceitar áudios com informações de codec no data URL.",
    ],
  },
  {
    titulo: "Arquivos compartilhados nas conversas",
    data: "21/05/2026",
    versao: "v1.16",
    autor: "Lucas Soares",
    descricao: [
      "Criado painel “Arquivos compartilhados” dentro de conversas diretas e grupos.",
      "Conteúdos passaram a ser separados por Arquivos, Imagens, Áudios e Links com contador por aba.",
      "Adicionadas ações para baixar anexos, abrir imagens e voltar para a mensagem original.",
    ],
  },
  {
    titulo: "Organização da lista de chats",
    data: "21/05/2026",
    versao: "v1.15",
    autor: "Lucas Soares",
    descricao: [
      "Conversas diretas e grupos agora podem ser marcados como favoritos.",
      "Favoritos aparecem no topo da lista, e os grupos são separados em Favoritos, Setores e Grupos.",
      "Adicionada opção para remover conversas diretas da lista do usuário sem apagar o histórico administrativo.",
    ],
  },
  {
    titulo: "Aviso geral obrigatório",
    data: "21/05/2026",
    versao: "v1.14",
    autor: "Lucas Soares",
    descricao: [
      "Criado aviso editável para todos os membros do sistema.",
      "Usuários precisam confirmar o aviso no botão com V para ele sair da tela.",
      "Aviso inicial informa que agora é possível ver visualizações de mensagem nos grupos.",
    ],
  },
  {
    titulo: "Visualizações em mensagens de grupo",
    data: "21/05/2026",
    versao: "v1.13",
    autor: "Lucas Soares",
    descricao: [
      "Adicionada a opção “Visualizações” na setinha das mensagens de grupo.",
      "Criado painel para mostrar quem recebeu e quem leu cada mensagem.",
      "Backend passou a registrar entrega e leitura por membro do grupo.",
    ],
  },
  {
    titulo: "Acessos rápidos de monitoramento",
    data: "21/05/2026",
    versao: "v1.12",
    autor: "Lucas Soares",
    descricao: [
      "Adicionados atalhos para Grafana e Zabbix na seção “Acessos rápidos”.",
      "Mantido o mesmo padrão visual dos demais botões da Home.",
      "Links abrem em nova aba para facilitar o acompanhamento dos sistemas.",
    ],
  },
  {
    titulo: "Changelog do sistema",
    data: "20/05/2026",
    versao: "v1.11",
    autor: "Lucas Soares",
    descricao: [
      "Criada a página “Changelog” em /changelog.",
      "Adicionado botão “Changelog” abaixo do botão “Relatar bug ou sugestão”.",
      "Histórico de mudanças passou a ficar disponível para os funcionários.",
    ],
  },
  {
    titulo: "Correção de mensagens em conversas erradas",
    data: "20/05/2026",
    versao: "v1.10",
    autor: "Lucas Soares",
    descricao: [
      "Corrigido bug em que mensagens de outra conversa apareciam temporariamente na tela atual.",
      "Listeners do Socket.IO passaram a validar conversa, grupo, remetente e destinatário antes de renderizar mensagens.",
      "Adicionada deduplicação para evitar mensagens repetidas após envio e retorno do socket.",
    ],
  },
  {
    titulo: "Lista de conversas diretas",
    data: "20/05/2026",
    versao: "v1.9",
    autor: "Lucas Soares",
    descricao: [
      "A lista de conversas diretas passou a exibir somente pessoas com histórico de conversa.",
      "Conversas são ordenadas pela última interação mais recente.",
      "Lista geral de usuários ficou separada para iniciar novas conversas sem poluir o histórico.",
    ],
  },
  {
    titulo: "Arquivos e áudios no chat",
    data: "20/05/2026",
    versao: "v1.8",
    autor: "Lucas Soares",
    descricao: [
      "Limite de upload aumentado para 200 MB.",
      "Adicionado suporte a PDF, Word e áudio WAV.",
      "Mantido suporte aos formatos de imagem e áudio que já funcionavam.",
    ],
  },
  {
    titulo: "Preview e download de anexos",
    data: "20/05/2026",
    versao: "v1.7",
    autor: "Lucas Soares",
    descricao: [
      "Imagens enviadas no chat agora abrem em tela cheia ao clicar.",
      "Adicionada opção “Salvar no computador” para imagens, áudios e arquivos.",
      "Removida a exibição de nomes técnicos/UUIDs embaixo das mídias.",
    ],
  },
  {
    titulo: "Feedback interno",
    data: "20/05/2026",
    versao: "v1.6",
    autor: "Lucas Soares",
    descricao: [
      "Adicionado fluxo para “Relatar bug ou sugestão”.",
      "Funcionários podem registrar problemas encontrados ou ideias de melhoria.",
      "Feedbacks ficam disponíveis para acompanhamento no painel administrativo.",
    ],
  },
  {
    titulo: "Avisos internos editáveis",
    data: "20/05/2026",
    versao: "v1.5",
    autor: "Lucas Soares",
    descricao: [
      "Criado painel administrativo para editar os avisos internos.",
      "Editor ficou mais simples para evitar edição manual de HTML completo.",
      "Conteúdo dos avisos passou a ser salvo no banco de dados.",
    ],
  },
  {
    titulo: "Botão de Avisos Internos",
    data: "20/05/2026",
    versao: "v1.4",
    autor: "Lucas Soares",
    descricao: [
      "Botão “Ver avisos internos” adicionado acima do banner principal.",
      "Acesso aos comunicados internos ficou mais visível para os funcionários.",
      "Botão pisca em laranja quando há atualização nos avisos internos.",
    ],
  },
  {
    titulo: "Reorganização da Home",
    data: "20/05/2026",
    versao: "v1.3",
    autor: "Lucas Soares",
    descricao: [
      "Logo reposicionado para ocupar menos espaço.",
      "Botão “Ver avisos internos” alinhado acima do banner.",
      "Banner principal subiu na página para melhorar o aproveitamento da tela.",
    ],
  },
  {
    titulo: "Navegação e marca do chat",
    data: "20/05/2026",
    versao: "v1.2",
    autor: "Lucas Soares",
    descricao: [
      "Título “Chats” foi substituído pela logo da Acessa Net.",
      "Logo ficou clicável para voltar à página principal com banners.",
      "Removida a logo que ficava acima do banner principal para reduzir espaço vazio.",
    ],
  },
  {
    titulo: "Melhorias em grupos",
    data: "20/05/2026",
    versao: "v1.1",
    autor: "Lucas Soares",
    descricao: [
      "Ajustes na gestão de membros dos grupos.",
      "Melhorado o controle de acesso para usuários que participam de mais de um grupo.",
      "Painel administrativo ganhou opções para adicionar membros por usuário, setor ou cargo.",
    ],
  },
];

const feedbackTipoLabel = {
  bug: "Bug resolvido",
  sugestao: "Sugestão atendida",
};

const feedbackTituloLabel = {
  bug: "Correção de bug resolvida",
  sugestao: "Melhoria aplicada a partir de feedback",
};

const feedbackPrioridadeLabel = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const changelogCategoriaLabel = {
  atualizacao: "Atualização",
  correcao: "Correção",
};

const obterDataInputHoje = () => {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
};

const criarChangelogFormInicial = (adminId = "") => ({
  categoria: "atualizacao",
  criado_por: adminId ? String(adminId) : "",
  titulo: "",
  versao: "",
  data: obterDataInputHoje(),
  texto: "",
});

const linhasDoTexto = (texto = "") => (
  String(texto)
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
);

const formatarDataChangelog = (data) => {
  if (!data) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const obterTipoChangelog = (item) => {
  if (item.categoria && changelogCategoriaLabel[item.categoria]) {
    return {
      label: changelogCategoriaLabel[item.categoria],
      className: item.categoria === "correcao" ? "correcao" : "atualizacao",
    };
  }

  const titulo = item.titulo.toLowerCase();
  const descricao = item.descricao.join(" ").toLowerCase();
  const ehCorrecao = titulo.includes("correção")
    || descricao.includes("corrigido")
    || descricao.includes("corrigida")
    || descricao.includes("corrigir");

  return ehCorrecao
    ? { label: "Correção", className: "correcao" }
    : { label: "Atualização", className: "atualizacao" };
};

const formatarDataCompleta = (data) => {
  if (!data) return "-";

  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Changelog() {
  const [publicandoAviso, setPublicandoAviso] = useState(null);
  const [mensagemAviso, setMensagemAviso] = useState("");
  const [feedbacksResolvidos, setFeedbacksResolvidos] = useState([]);
  const [carregandoFeedbacks, setCarregandoFeedbacks] = useState(true);
  const [erroFeedbacks, setErroFeedbacks] = useState("");
  const [changelogsCriados, setChangelogsCriados] = useState([]);
  const [carregandoChangelogs, setCarregandoChangelogs] = useState(true);
  const [erroChangelogs, setErroChangelogs] = useState("");
  const [modalCriarAberto, setModalCriarAberto] = useState(false);
  const [salvandoChangelog, setSalvandoChangelog] = useState(false);
  const [erroCriarChangelog, setErroCriarChangelog] = useState("");
  const [changelogForm, setChangelogForm] = useState(criarChangelogFormInicial);
  const [adminsChangelog, setAdminsChangelog] = useState([]);
  const [carregandoAdminsChangelog, setCarregandoAdminsChangelog] = useState(false);
  const [erroAdminsChangelog, setErroAdminsChangelog] = useState("");

  const token = useMemo(() => localStorage.getItem("token"), []);
  const headers = useMemo(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token]);
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);
  const isAdmin = user?.perfil === "admin";

  const changelogItemsCriados = useMemo(() => (
    changelogsCriados.map((item) => ({
      id: `criado-${item.id}`,
      categoria: item.categoria,
      titulo: item.titulo,
      data: formatarDataChangelog(item.data),
      versao: item.versao,
      autor: item.criado_por_nome || "Administração",
      descricao: linhasDoTexto(item.texto),
    }))
  ), [changelogsCriados]);

  const changelogItemsExibidos = useMemo(() => (
    [...changelogItemsCriados, ...changelogItems]
  ), [changelogItemsCriados]);

  const carregarChangelogsCriados = useCallback(async () => {
    if (!token) return;

    try {
      setErroChangelogs("");
      setCarregandoChangelogs(true);

      const { data } = await api.get("/changelog", { headers });
      setChangelogsCriados(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao carregar changelogs criados:", err);
      setErroChangelogs("Não foi possível carregar os changelogs criados agora.");
    } finally {
      setCarregandoChangelogs(false);
    }
  }, [headers, token]);

  const carregarAdminsChangelog = useCallback(async () => {
    if (!token || !isAdmin) return;

    try {
      setErroAdminsChangelog("");
      setCarregandoAdminsChangelog(true);

      const { data } = await api.get("/admin/usuarios", { headers });
      const admins = Array.isArray(data)
        ? data.filter((usuario) => usuario.perfil === "admin")
        : [];

      setAdminsChangelog(admins);
    } catch (err) {
      console.error("Erro ao carregar admins para changelog:", err);
      setErroAdminsChangelog("Não foi possível carregar os admins.");
    } finally {
      setCarregandoAdminsChangelog(false);
    }
  }, [headers, isAdmin, token]);

  const carregarFeedbacksResolvidos = useCallback(async () => {
    if (!token) return;

    try {
      setErroFeedbacks("");
      setCarregandoFeedbacks(true);

      const { data } = await api.get("/feedbacks/resolvidos", { headers });
      setFeedbacksResolvidos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao carregar feedbacks resolvidos:", err);
      setErroFeedbacks("Não foi possível carregar as correções resolvidas agora.");
    } finally {
      setCarregandoFeedbacks(false);
    }
  }, [headers, token]);

  useEffect(() => {
    carregarChangelogsCriados();
    carregarFeedbacksResolvidos();
    carregarAdminsChangelog();
  }, [carregarAdminsChangelog, carregarChangelogsCriados, carregarFeedbacksResolvidos]);

  const obterAdminInicialChangelog = useCallback(() => {
    const adminAtual = adminsChangelog.find((admin) => Number(admin.id) === Number(user?.id));
    return String(adminAtual?.id || adminsChangelog[0]?.id || user?.id || "");
  }, [adminsChangelog, user?.id]);

  const abrirModalCriar = () => {
    setErroCriarChangelog("");
    setChangelogForm(criarChangelogFormInicial(obterAdminInicialChangelog()));
    setModalCriarAberto(true);
  };

  const fecharModalCriar = () => {
    if (salvandoChangelog) return;

    setModalCriarAberto(false);
    setErroCriarChangelog("");
  };

  const alterarChangelogForm = (campo, valor) => {
    setErroCriarChangelog("");
    setChangelogForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const criarChangelog = async (event) => {
    event.preventDefault();
    if (!token) return;

    const payload = {
      categoria: changelogForm.categoria,
      criado_por: Number(changelogForm.criado_por),
      titulo: changelogForm.titulo.trim(),
      versao: changelogForm.versao.trim(),
      data: changelogForm.data,
      texto: changelogForm.texto.trim(),
    };

    if (!payload.criado_por || !payload.titulo || !payload.versao || !payload.data || !payload.texto) {
      setErroCriarChangelog("Preencha admin responsável, título, versão, data e texto para criar o changelog.");
      return;
    }

    try {
      setSalvandoChangelog(true);
      setErroCriarChangelog("");

      const { data } = await api.post("/admin/changelog", payload, { headers });
      setChangelogsCriados((atuais) => [data, ...atuais]);
      setModalCriarAberto(false);
      setMensagemAviso(`"${data.titulo}" criado no changelog.`);
      setChangelogForm(criarChangelogFormInicial(obterAdminInicialChangelog()));
    } catch (err) {
      console.error("Erro ao criar changelog:", err);
      setErroCriarChangelog(err.response?.data?.error || "Não foi possível criar o changelog.");
    } finally {
      setSalvandoChangelog(false);
    }
  };

  const publicarChangelogComoAviso = async (item) => {
    if (!token) return;

    try {
      setPublicandoAviso(item.titulo);
      setMensagemAviso("");

      await api.put("/admin/aviso-geral", {
        titulo: item.titulo,
        mensagem: [
          `${item.data}${item.versao ? ` · ${item.versao}` : ""}`,
          "",
          ...item.descricao.map((linha) => `- ${linha}`),
        ].join("\n"),
        ativo: true,
      }, { headers });

      setMensagemAviso(`"${item.titulo}" publicado no aviso da tela.`);
    } catch (err) {
      console.error("Erro ao publicar changelog como aviso:", err);
      setMensagemAviso(err.response?.data?.error || "Não foi possível publicar o aviso.");
    } finally {
      setPublicandoAviso(null);
    }
  };

  return (
    <main className="changelog-page">
      <style>{`
        .changelog-page {
          min-height: 100vh;
          padding: 32px;
          background:
            radial-gradient(circle at top left, rgba(34, 199, 255, 0.14), transparent 34%),
            #061425;
          color: #ffffff;
        }

        .changelog-shell {
          width: min(100%, 1280px);
          margin: 0 auto;
        }

        .changelog-content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 390px);
          align-items: start;
          gap: 22px;
        }

	        .changelog-header {
	          display: flex;
	          align-items: center;
	          justify-content: space-between;
	          gap: 16px;
	          margin-bottom: 28px;
	        }

	        .changelog-header-actions {
	          display: flex;
	          align-items: center;
	          justify-content: flex-end;
	          gap: 10px;
	          flex-wrap: wrap;
	        }

        .changelog-title-block h1 {
          margin: 0 0 8px;
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1.05;
          letter-spacing: 0;
        }

        .changelog-title-block p {
          margin: 0;
          color: rgba(255, 255, 255, 0.68);
          font-size: 15px;
        }

	        .changelog-back-link,
	        .changelog-create-button {
	          display: inline-flex;
	          align-items: center;
	          justify-content: center;
	          border: 1px solid rgba(80, 190, 255, 0.24);
          border-radius: 999px;
          padding: 10px 16px;
          background: rgba(0, 174, 255, 0.08);
          color: #8bdcff;
	          font-size: 13px;
	          font-weight: 800;
	          text-decoration: none;
	          white-space: nowrap;
	          cursor: pointer;
	          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
	        }

	        .changelog-create-button {
	          background: linear-gradient(135deg, rgba(34, 199, 255, 0.22), rgba(74, 222, 128, 0.14));
	          color: #e9fbff;
	        }

		        .changelog-back-link:hover,
		        .changelog-create-button:hover {
		          transform: translateY(-2px);
		          border-color: rgba(80, 190, 255, 0.42);
		          background: rgba(0, 174, 255, 0.14);
		        }

		        .changelog-section + .changelog-section {
		          margin-top: 34px;
		        }

		        .changelog-content-grid > .changelog-section + .changelog-section {
		          margin-top: 0;
		        }

		        .changelog-resolved-section {
		          position: sticky;
		          top: 24px;
		        }

	        .changelog-section-heading {
	          display: flex;
	          align-items: flex-end;
	          justify-content: space-between;
	          gap: 18px;
	          margin-bottom: 14px;
	        }

	        .changelog-section-heading h2 {
	          margin: 0 0 6px;
	          font-size: 22px;
	          line-height: 1.2;
	          letter-spacing: 0;
	        }

	        .changelog-section-heading p {
	          margin: 0;
	          color: rgba(255, 255, 255, 0.64);
	          font-size: 14px;
	          line-height: 1.5;
	        }

	        .changelog-section-kicker {
	          display: inline-flex;
	          align-items: center;
	          width: fit-content;
	          margin-bottom: 8px;
	          border: 1px solid rgba(139, 220, 255, 0.22);
	          border-radius: 999px;
	          padding: 5px 10px;
	          color: #8bdcff;
	          background: rgba(34, 199, 255, 0.08);
	          font-size: 11px;
	          font-weight: 900;
	          letter-spacing: 0;
	          text-transform: uppercase;
	        }

		        .changelog-list {
		          display: grid;
		          gap: 16px;
		        }

		        .changelog-resolved-section .changelog-list {
		          gap: 12px;
		        }

        .changelog-item {
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
        }

        .changelog-item-top {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 8px;
        }

	        .changelog-item-title {
	          margin: 0;
	          font-size: 18px;
	          line-height: 1.3;
	          letter-spacing: 0;
	        }

		        .changelog-resolved-section .changelog-item {
		          padding: 16px;
		        }

	        .changelog-title-with-type {
	          display: flex;
	          align-items: center;
	          gap: 10px;
	          flex-wrap: wrap;
	        }

	        .changelog-type-badge {
	          display: inline-flex;
	          align-items: center;
	          border-radius: 999px;
	          padding: 5px 9px;
	          font-size: 11px;
	          font-weight: 900;
	          line-height: 1;
	          letter-spacing: 0;
	          text-transform: uppercase;
	        }

	        .changelog-type-atualizacao {
	          border: 1px solid rgba(139, 220, 255, 0.24);
	          background: rgba(34, 199, 255, 0.1);
	          color: #9ee7ff;
	        }

	        .changelog-type-correcao {
	          border: 1px solid rgba(74, 222, 128, 0.28);
	          background: rgba(34, 197, 94, 0.12);
	          color: #86efac;
	        }

	        .changelog-author {
	          color: #22c7ff;
	          font-weight: 800;
	          white-space: nowrap;
        }

        .changelog-date {
          margin-bottom: 10px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          font-weight: 700;
        }

        .changelog-version {
          color: #8bdcff;
        }

        .changelog-item ul {
          margin: 0;
          padding-left: 18px;
        }

        .changelog-item li {
          margin-bottom: 6px;
          color: rgba(255, 255, 255, 0.78);
          line-height: 1.5;
        }

        .changelog-item li:last-child {
          margin-bottom: 0;
        }

        .changelog-admin-message {
          margin: 0 0 16px;
          border: 1px solid rgba(34, 199, 255, 0.2);
          border-radius: 12px;
          background: rgba(34, 199, 255, 0.08);
          color: #a7e8ff;
          font-size: 13px;
          font-weight: 800;
          padding: 12px 14px;
        }

        .changelog-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 14px;
        }

        .changelog-notice-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(80, 190, 255, 0.24);
          border-radius: 999px;
          padding: 9px 14px;
          background: rgba(0, 174, 255, 0.08);
          color: #8bdcff;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .changelog-notice-button:hover {
          transform: translateY(-2px);
          border-color: rgba(80, 190, 255, 0.42);
          background: rgba(0, 174, 255, 0.14);
        }

	        .changelog-notice-button:disabled {
	          cursor: not-allowed;
	          opacity: 0.6;
	          transform: none;
	        }

	        .changelog-state-card {
	          border: 1px solid rgba(255, 255, 255, 0.08);
	          border-radius: 14px;
	          padding: 18px;
	          background: rgba(255, 255, 255, 0.04);
	          color: rgba(255, 255, 255, 0.72);
	          font-weight: 700;
	        }

	        .changelog-feedback-description {
	          margin: 12px 0 0;
	          color: rgba(255, 255, 255, 0.78);
	          line-height: 1.55;
	          white-space: pre-wrap;
	        }

	        .changelog-feedback-meta {
	          display: flex;
	          flex-wrap: wrap;
	          gap: 8px;
	          margin-top: 14px;
	        }

	        .changelog-feedback-meta span,
	        .changelog-resolved-status {
	          display: inline-flex;
	          align-items: center;
	          border: 1px solid rgba(255, 255, 255, 0.1);
	          border-radius: 999px;
	          padding: 6px 10px;
	          background: rgba(255, 255, 255, 0.04);
	          color: rgba(255, 255, 255, 0.72);
	          font-size: 12px;
	          font-weight: 800;
	        }

	        .changelog-resolved-status {
	          border-color: rgba(74, 222, 128, 0.28);
	          color: #86efac;
	          background: rgba(34, 197, 94, 0.1);
	          white-space: nowrap;
	        }

	        .changelog-modal-overlay {
	          position: fixed;
	          inset: 0;
	          z-index: 60;
	          display: flex;
	          align-items: center;
	          justify-content: center;
	          padding: 20px;
	          background: rgba(1, 8, 18, 0.72);
	          backdrop-filter: blur(10px);
	        }

	        .changelog-modal {
	          width: min(620px, 100%);
	          max-height: calc(100vh - 40px);
	          overflow: auto;
	          border: 1px solid rgba(139, 220, 255, 0.18);
	          border-radius: 16px;
	          background: #071527;
	          color: #ffffff;
	          box-shadow: 0 24px 90px rgba(0, 0, 0, 0.5);
	        }

	        .changelog-modal-header {
	          display: flex;
	          align-items: flex-start;
	          justify-content: space-between;
	          gap: 16px;
	          padding: 18px 18px 14px;
	          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	        }

	        .changelog-modal-header h2 {
	          margin: 0 0 6px;
	          font-size: 20px;
	          letter-spacing: 0;
	        }

	        .changelog-modal-header p {
	          margin: 0;
	          color: rgba(255, 255, 255, 0.64);
	          font-size: 13px;
	          line-height: 1.45;
	        }

	        .changelog-modal-close {
	          width: 34px;
	          height: 34px;
	          border: 1px solid rgba(255, 255, 255, 0.12);
	          border-radius: 50%;
	          background: rgba(255, 255, 255, 0.06);
	          color: #ffffff;
	          cursor: pointer;
	          font-size: 22px;
	          line-height: 1;
	        }

	        .changelog-modal-body {
	          display: grid;
	          grid-template-columns: repeat(2, minmax(0, 1fr));
	          gap: 12px;
	          padding: 18px;
	        }

	        .changelog-modal-body label {
	          display: flex;
	          flex-direction: column;
	          gap: 7px;
	          color: rgba(255, 255, 255, 0.72);
	          font-size: 12px;
	          font-weight: 800;
	        }

	        .changelog-modal-body input,
	        .changelog-modal-body select,
	        .changelog-modal-body textarea {
	          width: 100%;
	          border: 1px solid rgba(139, 220, 255, 0.18);
	          border-radius: 12px;
	          padding: 11px 12px;
	          background: rgba(255, 255, 255, 0.06);
	          color: #ffffff;
	          font: inherit;
	          outline: none;
	        }

	        .changelog-modal-body select option {
	          background: #071527;
	          color: #ffffff;
	        }

	        .changelog-modal-body textarea {
	          min-height: 150px;
	          resize: vertical;
	          line-height: 1.5;
	        }

	        .changelog-modal-body input:focus,
	        .changelog-modal-body select:focus,
	        .changelog-modal-body textarea:focus {
	          border-color: rgba(139, 220, 255, 0.46);
	          box-shadow: 0 0 0 3px rgba(34, 199, 255, 0.12);
	        }

	        .changelog-field-wide {
	          grid-column: 1 / -1;
	        }

	        .changelog-modal-error {
	          grid-column: 1 / -1;
	          border: 1px solid rgba(248, 113, 113, 0.32);
	          border-radius: 12px;
	          padding: 10px 12px;
	          background: rgba(239, 68, 68, 0.12);
	          color: #fecaca;
	          font-size: 13px;
	          font-weight: 800;
	        }

	        .changelog-modal-actions {
	          display: flex;
	          justify-content: flex-end;
	          gap: 10px;
	          padding: 0 18px 18px;
	        }

	        .changelog-modal-secondary,
	        .changelog-modal-primary {
	          display: inline-flex;
	          align-items: center;
	          justify-content: center;
	          border-radius: 999px;
	          padding: 10px 16px;
	          cursor: pointer;
	          font-size: 13px;
	          font-weight: 900;
	          border: 1px solid rgba(255, 255, 255, 0.12);
	        }

	        .changelog-modal-secondary {
	          background: rgba(255, 255, 255, 0.06);
	          color: rgba(255, 255, 255, 0.78);
	        }

	        .changelog-modal-primary {
	          border-color: rgba(80, 190, 255, 0.34);
	          background: rgba(0, 174, 255, 0.16);
	          color: #b7ecff;
	        }

	        .changelog-modal-secondary:disabled,
	        .changelog-modal-primary:disabled,
	        .changelog-modal-close:disabled {
	          cursor: not-allowed;
	          opacity: 0.58;
	        }

	        [data-theme='claro'] .changelog-page {
	          background:
	            radial-gradient(circle at top left, rgba(14, 165, 233, 0.13), transparent 34%),
	            linear-gradient(135deg, #eef7fb 0%, #f8fafc 54%, #effcfb 100%);
	          color: #0f172a;
	        }

	        [data-theme='claro'] .changelog-title-block p,
	        [data-theme='claro'] .changelog-section-heading p,
	        [data-theme='claro'] .changelog-date,
	        [data-theme='claro'] .changelog-item li,
	        [data-theme='claro'] .changelog-feedback-description,
	        [data-theme='claro'] .changelog-feedback-meta span,
	        [data-theme='claro'] .changelog-state-card,
	        [data-theme='claro'] .changelog-modal-header p,
	        [data-theme='claro'] .changelog-modal-body label,
	        [data-theme='claro'] .changelog-modal-secondary {
	          color: #64748b;
	        }

	        [data-theme='claro'] .changelog-item,
	        [data-theme='claro'] .changelog-state-card,
	        [data-theme='claro'] .changelog-modal {
	          border-color: rgba(15, 23, 42, 0.1);
	          background: rgba(255, 255, 255, 0.9);
	          box-shadow: 0 18px 48px rgba(15, 23, 42, 0.09);
	        }

	        [data-theme='claro'] .changelog-back-link,
	        [data-theme='claro'] .changelog-notice-button,
	        [data-theme='claro'] .changelog-modal-secondary,
	        [data-theme='claro'] .changelog-modal-close,
	        [data-theme='claro'] .changelog-feedback-meta span {
	          border-color: rgba(15, 23, 42, 0.12);
	          background: rgba(255, 255, 255, 0.8);
	          color: #0369a1;
	        }

	        [data-theme='claro'] .changelog-create-button,
	        [data-theme='claro'] .changelog-modal-primary {
	          color: #075985;
	          background: linear-gradient(135deg, rgba(14, 165, 233, 0.18), rgba(20, 184, 166, 0.14));
	        }

	        [data-theme='claro'] .changelog-section-kicker,
	        [data-theme='claro'] .changelog-admin-message {
	          border-color: rgba(14, 165, 233, 0.18);
	          background: rgba(14, 165, 233, 0.08);
	          color: #0369a1;
	        }

	        [data-theme='claro'] .changelog-modal-header {
	          border-color: rgba(15, 23, 42, 0.1);
	        }

	        [data-theme='claro'] .changelog-modal-body input,
	        [data-theme='claro'] .changelog-modal-body select,
	        [data-theme='claro'] .changelog-modal-body textarea {
	          border-color: rgba(15, 23, 42, 0.12);
	          background: rgba(248, 250, 252, 0.92);
	          color: #0f172a;
	        }

	        [data-theme='claro'] .changelog-modal-body select option {
	          background: #ffffff;
	          color: #0f172a;
	        }

		        @media (max-width: 768px) {
	          .changelog-page {
	            padding: 20px;
	          }

	          .changelog-header {
	            flex-direction: column;
	            align-items: stretch;
	          }

		          .changelog-header-actions {
		            align-items: stretch;
		            flex-direction: column;
		          }

		          .changelog-content-grid {
		            grid-template-columns: 1fr;
		          }

		          .changelog-resolved-section {
		            position: static;
		          }

	          .changelog-section-heading {
	            align-items: stretch;
	            flex-direction: column;
	          }

	          .changelog-back-link,
	          .changelog-create-button {
	            width: 100%;
	          }

          .changelog-item-top {
            flex-direction: column;
            gap: 4px;
          }

          .changelog-actions {
            justify-content: stretch;
          }

	          .changelog-notice-button {
	            width: 100%;
	          }

	          .changelog-modal-body {
	            grid-template-columns: 1fr;
	          }

	          .changelog-modal-actions {
	            flex-direction: column-reverse;
	          }

	          .changelog-modal-secondary,
	          .changelog-modal-primary {
	            width: 100%;
	          }
	        }
      `}</style>

      <div className="changelog-shell">
        <header className="changelog-header">
          <div className="changelog-title-block">
            <h1>Changelog</h1>
            <p>Histórico de mudanças do sistema interno.</p>
          </div>

	          <div className="changelog-header-actions">
	            {isAdmin && (
	              <button
	                type="button"
	                className="changelog-create-button"
	                onClick={abrirModalCriar}
	              >
	                Criar
	              </button>
	            )}

	            <Link to="/chat" className="changelog-back-link">
	              Voltar para Home
	            </Link>
	          </div>
	        </header>

        {isAdmin && mensagemAviso && (
          <div className="changelog-admin-message">{mensagemAviso}</div>
        )}

        <div className="changelog-content-grid">
          <section className="changelog-section" aria-label="Atualizações do sistema">
            <div className="changelog-section-heading">
              <div>
                <span className="changelog-section-kicker">Atualizações</span>
                <h2>Atualizações do sistema</h2>
                <p>Novidades, melhorias e ajustes publicados no Chat Interno NOC.</p>
              </div>
            </div>

	          {carregandoChangelogs && (
	            <div className="changelog-state-card">Carregando changelogs criados...</div>
	          )}

	          {erroChangelogs && (
	            <div className="changelog-state-card">{erroChangelogs}</div>
	          )}

	          <div className="changelog-list">
	            {changelogItemsExibidos.map((item) => {
	              const tipo = obterTipoChangelog(item);

	              return (
	                <article className="changelog-item" key={item.id || item.titulo}>
                  <div className="changelog-item-top">
                    <div className="changelog-title-with-type">
                      <span className={`changelog-type-badge changelog-type-${tipo.className}`}>
                        {tipo.label}
                      </span>
                      <h2 className="changelog-item-title">{item.titulo}</h2>
                    </div>
                    <span className="changelog-author">{item.autor}</span>
                  </div>

                  <div className="changelog-date">
                    {item.data}
                    {item.versao ? (
                      <>
                        {" · "}
                        <span className="changelog-version">{item.versao}</span>
                      </>
                    ) : null}
                  </div>

	                  {item.descricao.length > 0 ? (
	                    <ul>
	                      {item.descricao.map((linha, index) => (
	                        <li key={`${linha}-${index}`}>{linha}</li>
	                      ))}
	                    </ul>
	                  ) : null}

                  {isAdmin && (
                    <div className="changelog-actions">
                      <button
                        type="button"
                        className="changelog-notice-button"
                        onClick={() => publicarChangelogComoAviso(item)}
                        disabled={publicandoAviso === item.titulo}
                      >
                        {publicandoAviso === item.titulo ? "Publicando..." : "Subir no aviso da tela"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          </section>

	        <section className="changelog-section changelog-resolved-section" aria-label="Correções e feedbacks resolvidos">
          <div className="changelog-section-heading">
            <div>
              <span className="changelog-section-kicker">Correções</span>
              <h2>Correções e feedbacks resolvidos</h2>
              <p>Itens marcados como resolvidos pela administração, exibindo quem resolveu sem mostrar quem reportou.</p>
            </div>
          </div>

          {carregandoFeedbacks ? (
            <div className="changelog-state-card">Carregando correções resolvidas...</div>
          ) : erroFeedbacks ? (
            <div className="changelog-state-card">{erroFeedbacks}</div>
          ) : feedbacksResolvidos.length === 0 ? (
            <div className="changelog-state-card">Nenhum feedback resolvido publicado ainda.</div>
          ) : (
            <div className="changelog-list">
              {feedbacksResolvidos.map((feedback) => (
                <article className="changelog-item" key={feedback.id}>
                  <div className="changelog-item-top">
                    <div className="changelog-title-with-type">
                      <span className="changelog-type-badge changelog-type-correcao">
                        {feedbackTipoLabel[feedback.tipo] || "Resolvido"}
                      </span>
                      <h2 className="changelog-item-title">
                        {feedbackTituloLabel[feedback.tipo] || "Feedback resolvido"}
                      </h2>
                    </div>
                    <span className="changelog-resolved-status">Resolvido</span>
                  </div>

                  <div className="changelog-date">
                    Resolvido em {formatarDataCompleta(feedback.resolvido_em || feedback.updated_at || feedback.created_at)}
                  </div>

                  <p className="changelog-feedback-description">{feedback.descricao}</p>

                  <div className="changelog-feedback-meta">
	                    <span>Prioridade: {feedbackPrioridadeLabel[feedback.prioridade] || feedback.prioridade}</span>
	                    {feedback.resolvido_por_nome ? <span>Resolvido por: {feedback.resolvido_por_nome}</span> : null}
	                    {feedback.pagina ? <span>Página: {feedback.pagina}</span> : null}
	                  </div>
                </article>
              ))}
            </div>
          )}
		        </section>
        </div>

		        {modalCriarAberto && (
	          <div className="changelog-modal-overlay" onClick={fecharModalCriar}>
	            <form
	              className="changelog-modal"
	              onSubmit={criarChangelog}
	              onClick={(event) => event.stopPropagation()}
	              noValidate
	            >
	              <div className="changelog-modal-header">
	                <div>
	                  <h2>Criar changelog</h2>
	                  <p>Publique uma atualização ou correção com versão, data e texto.</p>
	                </div>

	                <button
	                  type="button"
	                  className="changelog-modal-close"
	                  onClick={fecharModalCriar}
	                  disabled={salvandoChangelog}
	                  aria-label="Fechar"
	                >
	                  ×
	                </button>
	              </div>

	              <div className="changelog-modal-body">
	                {erroCriarChangelog && (
	                  <div className="changelog-modal-error">{erroCriarChangelog}</div>
	                )}

	                <label>
	                  Categoria
	                  <select
	                    value={changelogForm.categoria}
	                    onChange={(event) => alterarChangelogForm("categoria", event.target.value)}
	                    disabled={salvandoChangelog}
	                  >
	                    <option value="atualizacao">Atualização</option>
	                    <option value="correcao">Correção</option>
	                  </select>
	                </label>

	                <label>
	                  Admin responsável
	                  <select
	                    value={changelogForm.criado_por}
	                    onChange={(event) => alterarChangelogForm("criado_por", event.target.value)}
	                    disabled={salvandoChangelog || carregandoAdminsChangelog}
	                  >
	                    <option value="">
	                      {carregandoAdminsChangelog ? "Carregando admins..." : "Selecione um admin"}
	                    </option>
	                    {adminsChangelog.map((admin) => (
	                      <option key={admin.id} value={admin.id}>
	                        {admin.nome}
	                      </option>
	                    ))}
	                  </select>
	                </label>

	                {erroAdminsChangelog && (
	                  <div className="changelog-modal-error">{erroAdminsChangelog}</div>
	                )}

	                <label>
	                  Versão
	                  <input
	                    type="text"
	                    value={changelogForm.versao}
	                    onChange={(event) => alterarChangelogForm("versao", event.target.value)}
	                    placeholder="v1.20"
	                    maxLength="40"
	                    disabled={salvandoChangelog}
	                  />
	                </label>

	                <label className="changelog-field-wide">
	                  Título
	                  <input
	                    type="text"
	                    value={changelogForm.titulo}
	                    onChange={(event) => alterarChangelogForm("titulo", event.target.value)}
	                    placeholder="Ex: Melhorias no painel de atendimento"
	                    maxLength="180"
	                    disabled={salvandoChangelog}
	                  />
	                </label>

	                <label className="changelog-field-wide">
	                  Data
	                  <input
	                    type="date"
	                    value={changelogForm.data}
	                    onChange={(event) => alterarChangelogForm("data", event.target.value)}
	                    disabled={salvandoChangelog}
	                  />
	                </label>

	                <label className="changelog-field-wide">
	                  Texto
	                  <textarea
	                    value={changelogForm.texto}
	                    onChange={(event) => alterarChangelogForm("texto", event.target.value)}
	                    placeholder="Escreva uma mudança por linha para aparecer em tópicos no changelog."
	                    maxLength="5000"
	                    disabled={salvandoChangelog}
	                  />
	                </label>
	              </div>

	              <div className="changelog-modal-actions">
	                <button
	                  type="button"
	                  className="changelog-modal-secondary"
	                  onClick={fecharModalCriar}
	                  disabled={salvandoChangelog}
	                >
	                  Cancelar
	                </button>

	                <button
	                  type="submit"
	                  className="changelog-modal-primary"
	                  disabled={salvandoChangelog}
	                >
	                  {salvandoChangelog ? "Criando..." : "Criar changelog"}
	                </button>
	              </div>
	            </form>
	          </div>
	        )}
	      </div>
	    </main>
	  );
}
