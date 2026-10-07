import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Crown,
  Gauge,
  Gift,
  History,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Shuffle,
  X,
} from "lucide-react";
import api from "../services/api";
import styles from "../styles/RouletteAdmin.module.css";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "campaigns", label: "Campanhas", icon: ClipboardList },
  { id: "prizes", label: "Prêmios", icon: Gift },
  { id: "spins", label: "Giros", icon: Shuffle },
  { id: "redemptions", label: "Resgates", icon: PackageCheck },
  { id: "history", label: "Histórico", icon: History },
  { id: "audit", label: "Auditoria", icon: ShieldCheck },
];

const DEFAULT_CAMPAIGN_FORM = {
  id: null,
  name: "",
  description: "",
  rules: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
  department_ids: [],
};

const DEFAULT_PRIZE_FORM = {
  id: null,
  campaign_id: "",
  name: "",
  public_name: "",
  real_name: "",
  description: "",
  image_url: "",
  icon: "",
  color: "#00d4ff",
  type: "OUTRO",
  stock: "",
  initial_stock: "",
  weight: 1,
  estimated_value: 0,
  is_mystery: false,
  is_jackpot: false,
  is_active: true,
};

const DEFAULT_GRANT_FORM = {
  target_type: "user",
  user_id: "",
  setor_id: "",
  quantity: 1,
  reason: "",
};

const getToken = () => localStorage.getItem("token") || "";

const getHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatMoney = (value) => Number(value || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const normalizeStatus = (status = "") => (
  String(status || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
);

const parseDepartmentSelection = (event) => (
  Array.from(event.target.selectedOptions).map((option) => Number(option.value)).filter(Boolean)
);

const toNumberOrEmpty = (value) => (value === null || value === undefined ? "" : value);

export default function RouletteAdmin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [history, setHistory] = useState([]);
  const [grants, setGrants] = useState([]);
  const [audit, setAudit] = useState([]);
  const [prizeTypes, setPrizeTypes] = useState(["FINANCEIRO", "PRODUTO", "BENEFICIO", "BENEFICIO_INTERNO", "OUTRO"]);
  const [redemptionStatuses, setRedemptionStatuses] = useState([]);
  const [campaignForm, setCampaignForm] = useState(DEFAULT_CAMPAIGN_FORM);
  const [prizeForm, setPrizeForm] = useState(DEFAULT_PRIZE_FORM);
  const [grantForm, setGrantForm] = useState(DEFAULT_GRANT_FORM);
  const [prizeImageFile, setPrizeImageFile] = useState(null);

  const activeCampaign = useMemo(() => (
    campaigns.find((campaign) => campaign.is_active) || campaigns[0] || null
  ), [campaigns]);

  const filteredPrizes = useMemo(() => (
    [...prizes].sort((a, b) => String(a.campaign_name).localeCompare(String(b.campaign_name), "pt-BR") || Number(a.id) - Number(b.id))
  ), [prizes]);

  const loadAdmin = useCallback(async ({ silent = false } = {}) => {
    const token = getToken();

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      if (!silent) setLoading(true);
      setError("");

      const [
        bootstrapRes,
        dashboardRes,
        redemptionsRes,
        historyRes,
        grantsRes,
        auditRes,
      ] = await Promise.all([
        api.get("/roulette/admin/bootstrap", { headers: getHeaders() }),
        api.get("/roulette/admin/dashboard", { headers: getHeaders() }),
        api.get("/roulette/admin/redemptions", { headers: getHeaders() }),
        api.get("/roulette/admin/history", { headers: getHeaders() }),
        api.get("/roulette/admin/grants", { headers: getHeaders() }),
        api.get("/roulette/admin/audit", { headers: getHeaders() }),
      ]);

      setDashboard(dashboardRes.data);
      setCampaigns(Array.isArray(bootstrapRes.data?.campaigns) ? bootstrapRes.data.campaigns : []);
      setPrizes(Array.isArray(bootstrapRes.data?.prizes) ? bootstrapRes.data.prizes : []);
      setUsers(Array.isArray(bootstrapRes.data?.users) ? bootstrapRes.data.users : []);
      setDepartments(Array.isArray(bootstrapRes.data?.departments) ? bootstrapRes.data.departments : []);
      setPrizeTypes(Array.isArray(bootstrapRes.data?.prize_types) ? bootstrapRes.data.prize_types : []);
      setRedemptionStatuses(Array.isArray(bootstrapRes.data?.redemption_statuses) ? bootstrapRes.data.redemption_statuses : []);
      setRedemptions(Array.isArray(redemptionsRes.data) ? redemptionsRes.data : []);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
      setGrants(Array.isArray(grantsRes.data) ? grantsRes.data : []);
      setAudit(Array.isArray(auditRes.data) ? auditRes.data : []);
    } catch (err) {
      console.error("Erro ao carregar admin da roleta:", err);

      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      setError(err.response?.status === 403
        ? "Seu usuário não tem permissão de administrador."
        : err.response?.data?.error || "Não foi possível carregar a administração da roleta.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  useEffect(() => {
    if (!prizeForm.campaign_id && activeCampaign?.id) {
      setPrizeForm((current) => ({ ...current, campaign_id: activeCampaign.id }));
    }
  }, [activeCampaign, prizeForm.campaign_id]);

  const setCampaignField = (field, value) => {
    setCampaignForm((current) => ({ ...current, [field]: value }));
  };

  const setPrizeField = (field, value) => {
    setPrizeForm((current) => ({ ...current, [field]: value }));
  };

  const setGrantField = (field, value) => {
    setGrantForm((current) => ({ ...current, [field]: value }));
  };

  const resetCampaignForm = () => {
    setCampaignForm(DEFAULT_CAMPAIGN_FORM);
  };

  const resetPrizeForm = () => {
    setPrizeForm({
      ...DEFAULT_PRIZE_FORM,
      campaign_id: activeCampaign?.id || "",
    });
    setPrizeImageFile(null);
  };

  const editCampaign = (campaign) => {
    setCampaignForm({
      id: campaign.id,
      name: campaign.name || "",
      description: campaign.description || "",
      rules: campaign.rules || "",
      starts_at: campaign.starts_at_input || "",
      ends_at: campaign.ends_at_input || "",
      is_active: Boolean(campaign.is_active),
      department_ids: campaign.department_ids || [],
    });
    setActiveTab("campaigns");
  };

  const editPrize = (prize) => {
    setPrizeForm({
      id: prize.id,
      campaign_id: prize.campaign_id || "",
      name: prize.name || "",
      public_name: prize.public_name || "",
      real_name: prize.real_name || "",
      description: prize.description || "",
      image_url: prize.image_url || "",
      icon: prize.icon || "",
      color: prize.color || "#00d4ff",
      type: prize.type || "OUTRO",
      stock: toNumberOrEmpty(prize.stock),
      initial_stock: toNumberOrEmpty(prize.initial_stock),
      weight: prize.weight ?? 1,
      estimated_value: prize.estimated_value ?? 0,
      is_mystery: Boolean(prize.is_mystery),
      is_jackpot: Boolean(prize.is_jackpot),
      is_active: Boolean(prize.is_active),
    });
    setPrizeImageFile(null);
    setActiveTab("prizes");
  };

  const saveCampaign = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        name: campaignForm.name,
        description: campaignForm.description,
        rules: campaignForm.rules,
        starts_at: campaignForm.starts_at,
        ends_at: campaignForm.ends_at,
        is_active: campaignForm.is_active,
        department_ids: campaignForm.department_ids,
      };

      if (campaignForm.id) {
        await api.put(`/roulette/admin/campaigns/${campaignForm.id}`, payload, { headers: getHeaders() });
        setSuccess("Campanha atualizada.");
      } else {
        await api.post("/roulette/admin/campaigns", payload, { headers: getHeaders() });
        setSuccess("Campanha criada.");
      }

      resetCampaignForm();
      await loadAdmin({ silent: true });
    } catch (err) {
      console.error("Erro ao salvar campanha:", err);
      setError(err.response?.data?.error || "Não foi possível salvar a campanha.");
    } finally {
      setSaving(false);
    }
  };

  const uploadPrizeImage = async (prizeId) => {
    if (!prizeImageFile || !prizeId) return null;

    const formData = new FormData();
    formData.append("imagem", prizeImageFile);

    const { data } = await api.post(`/roulette/admin/prizes/${prizeId}/image`, formData, {
      headers: {
        ...getHeaders(),
        "Content-Type": "multipart/form-data",
      },
    });

    return data?.image_url || null;
  };

  const savePrize = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        ...prizeForm,
        campaign_id: Number(prizeForm.campaign_id),
        stock: prizeForm.stock === "" ? "" : Number(prizeForm.stock),
        initial_stock: prizeForm.initial_stock === "" ? "" : Number(prizeForm.initial_stock),
        weight: Number(prizeForm.weight),
        estimated_value: Number(prizeForm.estimated_value || 0),
      };
      const response = prizeForm.id
        ? await api.put(`/roulette/admin/prizes/${prizeForm.id}`, payload, { headers: getHeaders() })
        : await api.post("/roulette/admin/prizes", payload, { headers: getHeaders() });

      await uploadPrizeImage(response.data?.id || prizeForm.id);

      setSuccess(prizeForm.id ? "Prêmio atualizado." : "Prêmio criado.");
      resetPrizeForm();
      await loadAdmin({ silent: true });
    } catch (err) {
      console.error("Erro ao salvar prêmio:", err);
      setError(err.response?.data?.error || "Não foi possível salvar o prêmio.");
    } finally {
      setSaving(false);
    }
  };

  const grantSpins = async (event) => {
    event.preventDefault();

    const targetLabel = grantForm.target_type === "all"
      ? "todos os funcionários"
      : grantForm.target_type === "department"
        ? "todos do setor selecionado"
        : "o funcionário selecionado";

    if (grantForm.target_type !== "user" && !window.confirm(`Conceder ${grantForm.quantity} giro(s) para ${targetLabel}?`)) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const { data } = await api.post("/roulette/admin/grants", {
        target_type: grantForm.target_type,
        user_id: grantForm.user_id ? Number(grantForm.user_id) : null,
        setor_id: grantForm.setor_id ? Number(grantForm.setor_id) : null,
        quantity: Number(grantForm.quantity),
        reason: grantForm.reason,
      }, {
        headers: getHeaders(),
      });

      setSuccess(`${data.total_users || 0} funcionário(s) receberam ${data.quantity || grantForm.quantity} giro(s).`);
      setGrantForm(DEFAULT_GRANT_FORM);
      await loadAdmin({ silent: true });
    } catch (err) {
      console.error("Erro ao conceder giros:", err);
      setError(err.response?.data?.error || "Não foi possível conceder giros.");
    } finally {
      setSaving(false);
    }
  };

  const updateRedemptionStatus = async (redemption, status) => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.patch(`/roulette/admin/redemptions/${redemption.id}/status`, {
        status,
        admin_note: redemption.admin_note || "",
      }, {
        headers: getHeaders(),
      });

      setSuccess("Resgate atualizado.");
      await loadAdmin({ silent: true });
    } catch (err) {
      console.error("Erro ao atualizar resgate:", err);
      setError(err.response?.data?.error || "Não foi possível atualizar o resgate.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>Carregando administração da roleta...</div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigate("/roleta-premios")}>
          <ArrowLeft size={18} />
          Roleta
        </button>

        <div className={styles.title}>
          <span><Crown size={23} /></span>
          <div>
            <p>Administração</p>
            <h1>Roleta de Prêmios</h1>
          </div>
        </div>

        <nav className={styles.tabs} aria-label="Menu administrativo da roleta">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? styles.activeTab : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {error && <div className={styles.errorBox}>{error}</div>}
      {success && <div className={styles.successBox}>{success}</div>}

      {activeTab === "dashboard" && dashboard && (
        <section className={styles.dashboard}>
          <div className={styles.metric}>
            <span>Giros realizados</span>
            <strong>{dashboard.total_spins || 0}</strong>
          </div>
          <div className={styles.metric}>
            <span>Funcionários participantes</span>
            <strong>{dashboard.total_participants || 0}</strong>
          </div>
          <div className={styles.metric}>
            <span>Valor estimado distribuído</span>
            <strong>{formatMoney(dashboard.estimated_value_distributed)}</strong>
          </div>
          <div className={styles.metric}>
            <span>Prêmios aguardando entrega</span>
            <strong>{dashboard.pending_redemptions || 0}</strong>
          </div>
          <div className={styles.metric}>
            <span>Giros disponíveis</span>
            <strong>{dashboard.available_spins || 0}</strong>
          </div>
          <div className={styles.metric}>
            <span>Estoque ativo</span>
            <strong>{dashboard.active_stock || 0}</strong>
          </div>
          <div className={styles.wideMetric}>
            <span>Campanha ativa</span>
            <strong>{dashboard.active_campaign?.name || "Nenhuma"}</strong>
            <small>{dashboard.active_campaign ? `${formatDate(dashboard.active_campaign.starts_at)} até ${formatDate(dashboard.active_campaign.ends_at)}` : ""}</small>
          </div>
          <div className={styles.wideMetric}>
            <span>Destaques</span>
            <strong>{dashboard.top_prize?.public_name || dashboard.top_prize?.name || "Sem giros"}</strong>
            <small>Raro: {dashboard.rare_prize?.public_name || dashboard.rare_prize?.name || "Sem histórico"}</small>
          </div>
        </section>
      )}

      {activeTab === "campaigns" && (
        <section className={styles.grid}>
          <form className={styles.formPanel} onSubmit={saveCampaign}>
            <div className={styles.panelHeader}>
              <h2>{campaignForm.id ? "Editar Campanha" : "Nova Campanha"}</h2>
              {campaignForm.id && (
                <button type="button" className={styles.iconButton} onClick={resetCampaignForm} title="Cancelar edição">
                  <X size={17} />
                </button>
              )}
            </div>

            <label>
              Nome
              <input value={campaignForm.name} onChange={(event) => setCampaignField("name", event.target.value)} required />
            </label>
            <label>
              Descrição
              <textarea value={campaignForm.description} onChange={(event) => setCampaignField("description", event.target.value)} rows={3} />
            </label>
            <label>
              Regras
              <textarea value={campaignForm.rules} onChange={(event) => setCampaignField("rules", event.target.value)} rows={4} />
            </label>
            <div className={styles.twoColumns}>
              <label>
                Início
                <input type="datetime-local" value={campaignForm.starts_at} onChange={(event) => setCampaignField("starts_at", event.target.value)} required />
              </label>
              <label>
                Fim
                <input type="datetime-local" value={campaignForm.ends_at} onChange={(event) => setCampaignField("ends_at", event.target.value)} required />
              </label>
            </div>
            <label>
              Setores
              <select multiple value={campaignForm.department_ids.map(String)} onChange={(event) => setCampaignField("department_ids", parseDepartmentSelection(event))}>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.nome}</option>
                ))}
              </select>
            </label>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={campaignForm.is_active} onChange={(event) => setCampaignField("is_active", event.target.checked)} />
              Campanha ativa
            </label>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              <Save size={18} />
              {saving ? "Salvando..." : "Salvar campanha"}
            </button>
          </form>

          <section className={styles.tablePanel}>
            <div className={styles.panelHeader}>
              <h2>Campanhas</h2>
              <button type="button" className={styles.secondaryButton} onClick={resetCampaignForm}>
                <Plus size={17} />
                Nova
              </button>
            </div>
            <div className={styles.table}>
              <span>Campanha</span>
              <span>Período</span>
              <span>Setores</span>
              <span>Status</span>
              <span>Ações</span>
              {campaigns.map((campaign) => (
                <div key={campaign.id} className={styles.tableRow}>
                  <strong>{campaign.name}</strong>
                  <small>{formatDate(campaign.starts_at)} até {formatDate(campaign.ends_at)}</small>
                  <small>{campaign.departments?.length ? campaign.departments.map((item) => item.nome).join(", ") : "Todos"}</small>
                  <em className={campaign.is_active ? styles.good : styles.muted}>{campaign.is_active ? "Ativa" : "Inativa"}</em>
                  <button type="button" className={styles.smallButton} onClick={() => editCampaign(campaign)}>
                    <Pencil size={15} />
                    Editar
                  </button>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === "prizes" && (
        <section className={styles.grid}>
          <form className={styles.formPanel} onSubmit={savePrize}>
            <div className={styles.panelHeader}>
              <h2>{prizeForm.id ? "Editar Prêmio" : "Novo Prêmio"}</h2>
              {prizeForm.id && (
                <button type="button" className={styles.iconButton} onClick={resetPrizeForm} title="Cancelar edição">
                  <X size={17} />
                </button>
              )}
            </div>

            <label>
              Campanha
              <select value={prizeForm.campaign_id} onChange={(event) => setPrizeField("campaign_id", event.target.value)} required>
                <option value="">Selecione</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
            <div className={styles.twoColumns}>
              <label>
                Nome
                <input value={prizeForm.name} onChange={(event) => setPrizeField("name", event.target.value)} required />
              </label>
              <label>
                Nome público
                <input value={prizeForm.public_name} onChange={(event) => setPrizeField("public_name", event.target.value)} />
              </label>
            </div>
            <label>
              Prêmio real
              <input value={prizeForm.real_name} onChange={(event) => setPrizeField("real_name", event.target.value)} />
            </label>
            <label>
              Descrição
              <textarea value={prizeForm.description} onChange={(event) => setPrizeField("description", event.target.value)} rows={3} />
            </label>
            <div className={styles.twoColumns}>
              <label>
                Tipo
                <select value={prizeForm.type} onChange={(event) => setPrizeField("type", event.target.value)}>
                  {prizeTypes.map((type) => (
                    <option key={type} value={type}>{normalizeStatus(type)}</option>
                  ))}
                </select>
              </label>
              <label>
                Cor
                <input type="color" value={prizeForm.color} onChange={(event) => setPrizeField("color", event.target.value)} />
              </label>
            </div>
            <div className={styles.threeColumns}>
              <label>
                Ícone
                <input value={prizeForm.icon} onChange={(event) => setPrizeField("icon", event.target.value)} maxLength={40} />
              </label>
              <label>
                Estoque
                <input type="number" min="0" value={prizeForm.stock} onChange={(event) => setPrizeField("stock", event.target.value)} />
              </label>
              <label>
                Estoque inicial
                <input type="number" min="0" value={prizeForm.initial_stock} onChange={(event) => setPrizeField("initial_stock", event.target.value)} />
              </label>
            </div>
            <div className={styles.twoColumns}>
              <label>
                Peso
                <input type="number" min="0" value={prizeForm.weight} onChange={(event) => setPrizeField("weight", event.target.value)} required />
              </label>
              <label>
                Valor estimado
                <input type="number" min="0" step="0.01" value={prizeForm.estimated_value} onChange={(event) => setPrizeField("estimated_value", event.target.value)} />
              </label>
            </div>
            <label>
              Imagem
              <input type="file" accept="image/*" onChange={(event) => setPrizeImageFile(event.target.files?.[0] || null)} />
            </label>
            <div className={styles.checkboxGrid}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={prizeForm.is_mystery} onChange={(event) => setPrizeField("is_mystery", event.target.checked)} />
                Prêmio misterioso
              </label>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={prizeForm.is_jackpot} onChange={(event) => setPrizeField("is_jackpot", event.target.checked)} />
                Jackpot
              </label>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={prizeForm.is_active} onChange={(event) => setPrizeField("is_active", event.target.checked)} />
                Ativo
              </label>
            </div>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              <Save size={18} />
              {saving ? "Salvando..." : "Salvar prêmio"}
            </button>
          </form>

          <section className={styles.tablePanel}>
            <div className={styles.panelHeader}>
              <h2>Prêmios da Roleta</h2>
              <button type="button" className={styles.secondaryButton} onClick={resetPrizeForm}>
                <Plus size={17} />
                Novo
              </button>
            </div>
            <div className={`${styles.table} ${styles.prizeTable}`}>
              <span>Prêmio</span>
              <span>Campanha</span>
              <span>Estoque</span>
              <span>Peso</span>
              <span>Probabilidade</span>
              <span>Valor</span>
              <span>Status</span>
              <span>Ações</span>
              {filteredPrizes.map((prize) => (
                <div key={prize.id} className={styles.tableRow}>
                  <strong>
                    <span className={styles.colorDot} style={{ "--dot-color": prize.color }} />
                    {prize.public_name || prize.name}
                    {prize.is_jackpot && <Crown size={15} />}
                  </strong>
                  <small>{prize.campaign_name}</small>
                  <small>{prize.stock === null || prize.stock === undefined ? "Ilimitado" : `${prize.stock}/${prize.initial_stock ?? prize.stock}`}</small>
                  <small>{prize.weight}</small>
                  <em className={prize.participates_in_draw ? styles.good : styles.muted}>{prize.probability_label}</em>
                  <small>{formatMoney(prize.estimated_value)}</small>
                  <em className={prize.is_active ? styles.good : styles.muted}>{prize.is_active ? "Ativo" : "Inativo"}</em>
                  <button type="button" className={styles.smallButton} onClick={() => editPrize(prize)}>
                    <Pencil size={15} />
                    Editar
                  </button>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === "spins" && (
        <section className={styles.grid}>
          <form className={styles.formPanel} onSubmit={grantSpins}>
            <div className={styles.panelHeader}>
              <h2>Conceder Giros</h2>
            </div>
            <label>
              Destino
              <select value={grantForm.target_type} onChange={(event) => setGrantField("target_type", event.target.value)}>
                <option value="user">Funcionário</option>
                <option value="department">Setor</option>
                <option value="all">Todos os funcionários</option>
              </select>
            </label>
            {grantForm.target_type === "user" && (
              <label>
                Funcionário
                <select value={grantForm.user_id} onChange={(event) => setGrantField("user_id", event.target.value)} required>
                  <option value="">Selecione</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.nome} · {user.setor_nome || "Sem setor"}</option>
                  ))}
                </select>
              </label>
            )}
            {grantForm.target_type === "department" && (
              <label>
                Setor
                <select value={grantForm.setor_id} onChange={(event) => setGrantField("setor_id", event.target.value)} required>
                  <option value="">Selecione</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.nome}</option>
                  ))}
                </select>
              </label>
            )}
            <div className={styles.twoColumns}>
              <label>
                Quantidade
                <input type="number" min="1" max="1000" value={grantForm.quantity} onChange={(event) => setGrantField("quantity", event.target.value)} required />
              </label>
              <label>
                Motivo
                <input value={grantForm.reason} onChange={(event) => setGrantField("reason", event.target.value)} placeholder="Meta de Agosto" />
              </label>
            </div>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              <Shuffle size={18} />
              {saving ? "Concedendo..." : "Conceder giros"}
            </button>
          </form>

          <section className={styles.tablePanel}>
            <div className={styles.panelHeader}>
              <h2>Saldos</h2>
            </div>
            <div className={`${styles.table} ${styles.balanceTable}`}>
              <span>Funcionário</span>
              <span>Setor</span>
              <span>Perfil</span>
              <span>Giros</span>
              {users.map((user) => (
                <div key={user.id} className={styles.tableRow}>
                  <strong>{user.nome}</strong>
                  <small>{user.setor_nome || "-"}</small>
                  <small>{normalizeStatus(user.perfil)}</small>
                  <em className={Number(user.available_spins) > 0 ? styles.good : styles.muted}>{user.available_spins || 0}</em>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.tablePanel}>
            <div className={styles.panelHeader}>
              <h2>Histórico de Concessões</h2>
            </div>
            <div className={`${styles.table} ${styles.grantsTable}`}>
              <span>Data</span>
              <span>Admin</span>
              <span>Destino</span>
              <span>Qtd.</span>
              <span>Motivo</span>
              {grants.map((grant) => (
                <div key={grant.id} className={styles.tableRow}>
                  <small>{formatDate(grant.created_at)}</small>
                  <strong>{grant.admin_name || "-"}</strong>
                  <small>{grant.target_type === "all" ? "Todos" : grant.target_user_name || grant.setor_nome || grant.target_type}</small>
                  <em className={styles.good}>+{grant.quantity}</em>
                  <small>{grant.reason || "-"}</small>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === "redemptions" && (
        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <h2>Resgates</h2>
          </div>
          <div className={`${styles.table} ${styles.redemptionTable}`}>
            <span>Funcionário</span>
            <span>Prêmio</span>
            <span>Campanha</span>
            <span>Status</span>
            <span>Ganho em</span>
            <span>Ação</span>
            {redemptions.map((redemption) => (
              <div key={redemption.id} className={styles.tableRow}>
                <strong>{redemption.user_name}</strong>
                <small>{redemption.prize?.result_name || redemption.prize?.name}</small>
                <small>{redemption.campaign_name}</small>
                <select
                  value={redemption.status}
                  onChange={(event) => updateRedemptionStatus(redemption, event.target.value)}
                  disabled={saving}
                >
                  {redemptionStatuses.map((status) => (
                    <option key={status} value={status}>{normalizeStatus(status)}</option>
                  ))}
                </select>
                <small>{formatDate(redemption.created_at)}</small>
                <button type="button" className={styles.smallButton} onClick={() => updateRedemptionStatus(redemption, redemption.status)} disabled={saving}>
                  <Save size={15} />
                  Salvar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "history" && (
        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <h2>Histórico de Giros</h2>
          </div>
          <div className={`${styles.table} ${styles.historyTable}`}>
            <span>Data</span>
            <span>Funcionário</span>
            <span>Setor</span>
            <span>Campanha</span>
            <span>Prêmio</span>
            <span>IP</span>
            <span>Status</span>
            {history.map((item) => (
              <div key={item.id} className={styles.tableRow}>
                <small>{formatDate(item.created_at)}</small>
                <strong>{item.user_name}</strong>
                <small>{item.setor_nome || "-"}</small>
                <small>{item.campaign_name}</small>
                <small>{item.prize_real_name || item.prize_public_name || item.prize_name || "-"}</small>
                <small>{item.ip || "-"}</small>
                <em className={item.status === "completed" ? styles.good : styles.muted}>{normalizeStatus(item.redemption_status || item.status)}</em>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "audit" && (
        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <h2>Auditoria</h2>
          </div>
          <div className={`${styles.table} ${styles.auditTable}`}>
            <span>Data</span>
            <span>Admin</span>
            <span>Ação</span>
            <span>Entidade</span>
            <span>Resumo</span>
            {audit.map((item) => (
              <div key={item.id} className={styles.tableRow}>
                <small>{formatDate(item.created_at)}</small>
                <strong>{item.admin_name || "-"}</strong>
                <em>{item.action}</em>
                <small>{item.entity} #{item.entity_id || "-"}</small>
                <small>{item.after?.name || item.after?.grant_uid || item.after?.status || item.metadata?.reason || "-"}</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
