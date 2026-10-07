import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Network,
  Save,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import api from '../services/api';
import { useInternalBack } from '../utils/internalNavigation';
import corridaCcnaImage from '../assets/competicao-ccna/corrida-ccnav7.png';
import styles from '../styles/CompeticaoCcna.module.css';

const STATUS_LABELS = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  aguardando_validacao: 'Aguardando validação',
  validado: 'Validado',
  ganhador: 'Ganhador',
};

const PROOF_STATUS_LABELS = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
};

const COMPETITION_STATUS_LABELS = {
  ativa: 'Ativa',
  encerrada: 'Encerrada',
  ganhador_definido: 'Ganhador definido',
};

const RULES = [
  'Para participar, clique em Participar agora.',
  'Apenas usuários participantes aparecem no ranking e no progresso.',
  'Conclua os 3 módulos do CCNA V7 até o prazo final.',
  'Envie um link de comprovação para cada módulo concluído.',
  'Somente administradores podem aprovar ou reprovar comprovações.',
  'O primeiro participante com os 3 módulos aprovados será definido como ganhador.',
  'A competição possui apenas 1 ganhador.',
];

const formatDateTime = (value) => {
  if (!value) return 'Ainda não informado';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const formatDate = (value) => {
  if (!value) return '31/12';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
};

export default function CompeticaoCcna({ embedded = false }) {
  const voltar = useInternalBack('/');
  const token = useMemo(() => localStorage.getItem('token'), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [proofFiles, setProofFiles] = useState({});
  const [adminConfig, setAdminConfig] = useState({ deadline_date: '', status: 'ativa' });
  const [adminNotes, setAdminNotes] = useState({});
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  const participant = data?.current_user_participant || null;
  const isParticipant = Boolean(participant);
  const isAdmin = Boolean(data?.is_admin);
  const modules = data?.modules || [];
  const participants = data?.participants || [];
  const config = data?.config || {};
  const companyAsn = data?.company_asn || '266468';

  const hydrateLocalForms = useCallback((payload) => {
    setAdminConfig({
      deadline_date: payload?.config?.deadline_date || '',
      status: payload?.config?.status || 'ativa',
    });
  }, []);

  const loadCompetition = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/ccna-competition', { headers });
      setData(response.data);
      hydrateLocalForms(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível carregar a competição.');
    } finally {
      setLoading(false);
    }
  }, [headers, hydrateLocalForms]);

  useEffect(() => {
    loadCompetition();
  }, [loadCompetition]);

  const applyPayload = (payload) => {
    setData((current) => ({
      ...current,
      ...payload,
      modules: payload.modules || current?.modules || [],
      is_admin: payload.is_admin ?? current?.is_admin,
      company_asn: payload.company_asn || current?.company_asn || '266468',
    }));
    hydrateLocalForms({ ...data, ...payload });
  };

  const handleJoin = async () => {
    setSaving('join');
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/ccna-competition/join', {}, { headers });
      applyPayload(response.data);
      setSuccess('Você está participando da Competição CCNA V7.');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível registrar sua participação.');
    } finally {
      setSaving('');
    }
  };

  const handleSaveProof = async (moduleId) => {
    const selectedFile = proofFiles[moduleId];

    if (!selectedFile) {
      setError('Selecione uma imagem de comprovação antes de enviar.');
      return;
    }

    setSaving(`proof-${moduleId}`);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('proof_image', selectedFile);

      const response = await api.put(
        `/ccna-competition/modules/${moduleId}`,
        formData,
        { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
      );
      applyPayload(response.data);
      setProofFiles((current) => ({
        ...current,
        [moduleId]: null,
      }));
      setSuccess('Comprovação enviada para validação.');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível salvar a comprovação.');
    } finally {
      setSaving('');
    }
  };

  const handleAdminValidate = async (participantId, moduleId, status) => {
    setSaving(`validate-${participantId}-${moduleId}-${status}`);
    setError('');
    setSuccess('');

    try {
      const response = await api.patch(
        `/ccna-competition/admin/modules/${participantId}/${moduleId}`,
        {
          status,
          admin_note: adminNotes[`${participantId}-${moduleId}`] || '',
        },
        { headers }
      );
      applyPayload(response.data);
      setSuccess(status === 'aprovado' ? 'Módulo aprovado.' : 'Módulo reprovado.');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível validar o módulo.');
    } finally {
      setSaving('');
    }
  };

  const handleAdminStatus = async (participantId, status) => {
    setSaving(`status-${participantId}`);
    setError('');
    setSuccess('');

    try {
      const response = await api.patch(
        `/ccna-competition/admin/participants/${participantId}/status`,
        { status },
        { headers }
      );
      applyPayload(response.data);
      setSuccess('Status do participante atualizado.');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível atualizar o status.');
    } finally {
      setSaving('');
    }
  };

  const handleAdminConfig = async () => {
    setSaving('config');
    setError('');
    setSuccess('');

    try {
      const response = await api.put('/ccna-competition/admin/config', adminConfig, { headers });
      applyPayload(response.data);
      setSuccess('Configuração da competição atualizada.');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível salvar a configuração.');
    } finally {
      setSaving('');
    }
  };

  return (
    <main className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <button type="button" className={styles.backButton} onClick={voltar}>
            <ArrowLeft size={18} />
            Voltar
          </button>

          <span className={styles.heroBadge}>
            <Trophy size={16} />
            Apenas 1 ganhador
          </span>
        </div>

        <div className={styles.heroGrid}>
          <div>
            <span className={styles.eyebrow}>Competição interna</span>
            <h1>Competição CCNA V7 - R$1000 para quem concluir os 3 módulos</h1>
            <p>
              A primeira pessoa a concluir e comprovar os 3 módulos oficiais do CCNA V7
              ganha R$1000.
            </p>

            <div className={styles.badgeRow}>
              <span>
                <Users size={15} />
                {participants.length} participantes
              </span>
              <span>
                <CalendarDays size={15} />
                Prazo final: {formatDate(config.deadline_date)}
              </span>
              <span>
                <ShieldCheck size={15} />
                {COMPETITION_STATUS_LABELS[config.status] || 'Ativa'}
              </span>
            </div>
          </div>

          <aside className={styles.raceImageCard}>
            <img
              src={corridaCcnaImage}
              alt="Corrida CCNA V7 - competição interna Acessanet"
              className={styles.raceImage}
            />
            <div className={styles.raceImageOverlay}>
              <span className={styles.racePrizeBadge}>
                <Trophy size={14} />
                R$1000
              </span>
              <span className={styles.raceCaption}>1º a entregar os 3 cursos ganha</span>
            </div>
          </aside>
        </div>

        <div className={styles.heroActions}>
          {isParticipant ? (
            <article className={styles.participationStatusCard}>
              <CheckCircle2 size={20} />
              <div>
                <strong>Você está participando</strong>
                <span>
                  {participant.progress || 0}/{participant.total_modules || 3} módulos aprovados
                  {participant.joined_at ? ` · Entrada: ${formatDateTime(participant.joined_at)}` : ''}
                </span>
              </div>
            </article>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleJoin}
              disabled={saving === 'join' || config.status !== 'ativa'}
            >
              {saving === 'join' ? <Loader2 className={styles.spin} size={18} /> : <UserPlus size={18} />}
              Participar agora
            </button>
          )}
        </div>
      </header>

      {error && <div className={styles.alertError}>{error}</div>}
      {success && <div className={styles.alertSuccess}>{success}</div>}

      {loading ? (
        <section className={styles.loadingBox}>
          <Loader2 className={styles.spin} size={24} />
          Carregando competição
        </section>
      ) : (
        <>
          <section className={styles.contentGrid}>
            <article className={`${styles.panel} ${styles.asCard}`}>
              <div className={styles.asIcon}>
                <Network size={26} />
              </div>

              <div className={styles.asContent}>
                <span className={styles.asLabel}>AS PARA O CURSO</span>
                <strong className={styles.asNumber}>AS{companyAsn}</strong>
                <p>Use este AS quando o curso solicitar a identificação da empresa/rede.</p>
              </div>

              <span className={styles.asBadge}>CCNA V7</span>
            </article>

            <article className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.eyebrow}>Cursos oficiais</span>
                  <h2>3 módulos CCNA V7</h2>
                </div>
              </div>

              <div className={styles.moduleGrid}>
                {modules.map((module, index) => (
                  <a
                    key={module.id}
                    className={styles.moduleCard}
                    href={module.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Módulo {index + 1}</span>
                    <strong>{module.title}</strong>
                    <em>
                      Acessar curso
                      <ExternalLink size={14} />
                    </em>
                  </a>
                ))}
              </div>
            </article>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Participantes</span>
                <h2>Quem está participando da competição</h2>
              </div>
            </div>

            {participants.length ? (
              <div className={styles.participantsList}>
                {participants.map((item) => (
                  <article
                    key={item.id}
                    className={`${styles.participantCard} ${
                      Number(item.user_id) === Number(participant?.user_id) ? styles.participantCardCurrent : ''
                    }`.trim()}
                  >
                    <div>
                      <strong>{item.nome}</strong>
                      <span>Entrou em: {formatDateTime(item.joined_at)}</span>
                    </div>
                    {Number(item.user_id) === Number(participant?.user_id) && (
                      <em className={styles.currentUserBadge}>Você</em>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyParticipants}>
                <strong>Nenhum participante entrou na competição ainda.</strong>
                <span>Quando alguém clicar em “Participar agora”, aparecerá aqui.</span>
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Comprovação</span>
                <h2>Envio dos módulos concluídos</h2>
              </div>
            </div>

            {isParticipant ? (
              <div className={styles.proofGrid}>
                {(participant.proofs || []).map((proof, index) => (
                  <article key={proof.module_id} className={styles.proofCard}>
                    <div className={styles.proofHeader}>
                      <span>Módulo {index + 1}</span>
                      <em className={styles[`proof_${proof.status}`] || styles.proof_pendente}>
                        {PROOF_STATUS_LABELS[proof.status] || proof.status}
                      </em>
                    </div>
                    <strong>{proof.title}</strong>
                    {proof.proof_url && (
                      <a
                        className={styles.proofImageLink}
                        href={proof.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img src={proof.proof_url} alt={`Comprovação enviada - ${proof.title}`} />
                        <span>
                          Ver imagem enviada
                          <ExternalLink size={13} />
                        </span>
                      </a>
                    )}
                    <label className={styles.proofFileField}>
                      Imagem de comprovação
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        onChange={(event) => setProofFiles((current) => ({
                          ...current,
                          [proof.module_id]: event.target.files?.[0] || null,
                        }))}
                      />
                      <span>
                        {proofFiles[proof.module_id]?.name || 'PNG, JPG, WEBP ou GIF até 20MB'}
                      </span>
                    </label>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => handleSaveProof(proof.module_id)}
                      disabled={saving === `proof-${proof.module_id}`}
                    >
                      {saving === `proof-${proof.module_id}` ? <Loader2 className={styles.spin} size={16} /> : <Save size={16} />}
                      Salvar comprovação
                    </button>
                    {proof.admin_note && <small className={styles.adminNote}>{proof.admin_note}</small>}
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyText}>Clique em Participar agora para liberar o envio de comprovações.</p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Regras</span>
                <h2>Como funciona</h2>
              </div>
            </div>
            <ul className={styles.rulesList}>
              {RULES.map((rule) => (
                <li key={rule}>
                  <CheckCircle2 size={16} />
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          {isAdmin && (
            <section className={`${styles.panel} ${styles.adminPanelShell}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.eyebrow}>Admin</span>
                  <h2>Painel administrativo</h2>
                </div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setAdminPanelOpen((current) => !current)}
                >
                  {adminPanelOpen ? 'Ocultar painel' : 'Abrir painel administrativo'}
                </button>
              </div>

              {adminPanelOpen && (
                <div className={styles.adminPanel}>
                  <div className={styles.adminConfig}>
                    <label>
                      Prazo final
                      <input
                        type="date"
                        value={adminConfig.deadline_date}
                        onChange={(event) => setAdminConfig((current) => ({
                          ...current,
                          deadline_date: event.target.value,
                        }))}
                      />
                    </label>

                    <label>
                      Status
                      <select
                        value={adminConfig.status}
                        onChange={(event) => setAdminConfig((current) => ({
                          ...current,
                          status: event.target.value,
                        }))}
                      >
                        {Object.entries(COMPETITION_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleAdminConfig}
                      disabled={saving === 'config'}
                    >
                      {saving === 'config' ? <Loader2 className={styles.spin} size={16} /> : <Save size={16} />}
                      Salvar configuração
                    </button>
                  </div>

                  <div className={styles.adminParticipants}>
                    {participants.map((item) => (
                      <article key={item.id} className={styles.adminParticipantCard}>
                        <div className={styles.participantTop}>
                          <div>
                            <strong>{item.nome}</strong>
                            <span>{item.email || 'Sem e-mail'} · {formatDateTime(item.joined_at)}</span>
                          </div>
                          <select
                            value={item.status}
                            onChange={(event) => handleAdminStatus(item.id, event.target.value)}
                            disabled={saving === `status-${item.id}`}
                          >
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </div>

                        <div className={styles.adminProofs}>
                          {(item.proofs || []).map((proof) => (
                            <div key={proof.module_id} className={styles.adminProofRow}>
                              <div>
                                <strong>{proof.title}</strong>
                                <span>{PROOF_STATUS_LABELS[proof.status] || proof.status}</span>
                                {proof.proof_url && (
                                  <a
                                    className={styles.adminProofImageLink}
                                    href={proof.proof_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <img src={proof.proof_url} alt={`Comprovação de ${item.nome} - ${proof.title}`} />
                                    <span>
                                      Abrir imagem enviada
                                      <ExternalLink size={13} />
                                    </span>
                                  </a>
                                )}
                              </div>

                              <input
                                type="text"
                                value={adminNotes[`${item.id}-${proof.module_id}`] ?? proof.admin_note ?? ''}
                                onChange={(event) => setAdminNotes((current) => ({
                                  ...current,
                                  [`${item.id}-${proof.module_id}`]: event.target.value,
                                }))}
                                placeholder="Observação da validação"
                              />

                              <div className={styles.adminActions}>
                                <button
                                  type="button"
                                  className={styles.approveButton}
                                  onClick={() => handleAdminValidate(item.id, proof.module_id, 'aprovado')}
                                  disabled={saving.startsWith(`validate-${item.id}-${proof.module_id}`)}
                                >
                                  <CheckCircle2 size={15} />
                                  Aprovar
                                </button>
                                <button
                                  type="button"
                                  className={styles.rejectButton}
                                  onClick={() => handleAdminValidate(item.id, proof.module_id, 'reprovado')}
                                  disabled={saving.startsWith(`validate-${item.id}-${proof.module_id}`)}
                                >
                                  <XCircle size={15} />
                                  Reprovar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
