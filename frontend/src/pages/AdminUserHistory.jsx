import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import styles from "../styles/Admin.module.css";

export default function AdminUserHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const token = useMemo(() => localStorage.getItem("token"), []);
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  useEffect(() => {
    const carregarHistorico = async () => {
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        setErro("");
        setLoading(true);

        const { data } = await api.get(`/admin/usuarios/${id}/mensagens`, {
          headers,
        });

        setUsuario(data.usuario);
        setMensagens(data.mensagens || []);
      } catch (err) {
        console.error("Erro ao carregar histórico do usuário:", err);
        if (err.response?.status === 404) {
          setErro("Usuário não encontrado ou sem histórico disponível.");
        } else {
          setErro("Não foi possível carregar o histórico de mensagens.");
        }
      } finally {
        setLoading(false);
      }
    };

    carregarHistorico();
  }, [headers, id, navigate, token]);

  const formatarData = (data) => {
    if (!data) return "-";
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderMensagem = (mensagem) => {
    if (mensagem.tipo_mensagem === "imagem") {
      return (
        <div className={styles.adminImageMessage}>
          <img
            src={mensagem.mensagem}
            alt={mensagem.anexo_nome || "Imagem anexada"}
          />
          <span>{mensagem.anexo_nome || "Imagem anexada"}</span>
        </div>
      );
    }

    if (mensagem.tipo_mensagem === "audio") {
      return (
        <div className={styles.adminAudioMessage}>
          <audio controls src={mensagem.mensagem} preload="metadata">
            Seu navegador não suporta áudio.
          </audio>
          <span>{mensagem.anexo_nome || "Áudio anexado"}</span>
        </div>
      );
    }

    return mensagem.mensagem || "";
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1>Histórico de mensagens</h1>
          <p className={styles.subtitle}>
            {usuario
              ? `Mensagens enviadas por ${usuario.nome} (${usuario.email})`
              : "Carregando informações do usuário..."}
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => navigate("/admin")}
          >
            Voltar ao painel
          </button>
        </div>
      </div>

      {erro ? (
        <div className={styles.tableWrap}>
          <p>{erro}</p>
        </div>
      ) : loading ? (
        <div className={styles.tableWrap}>
          <p>Carregando histórico...</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Conteúdo</th>
                <th>Contexto</th>
              </tr>
            </thead>
            <tbody>
              {mensagens.length === 0 ? (
                <tr>
                  <td colSpan="4" className={styles.emptyCell}>
                    Nenhuma mensagem encontrada para este usuário.
                  </td>
                </tr>
              ) : (
                mensagens.map((mensagem) => (
                  <tr key={mensagem.id}>
                    <td>{formatarData(mensagem.criada_em)}</td>
                    <td>{mensagem.tipo}</td>
                    <td>{renderMensagem(mensagem)}</td>
                    <td>{mensagem.contexto}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
