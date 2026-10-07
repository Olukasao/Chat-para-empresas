import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Search, ShieldCheck, Users } from 'lucide-react';
import api from '../services/api';
import adminStyles from '../styles/Admin.module.css';
import styles from '../styles/AdminPurchasePermissions.module.css';
import { getPerfilLabel } from '../utils/perfis';

const formatDateTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const grantKey = (type, subject) => {
  if (!subject) return '';
  if (type === 'role') return `role:${subject.id}`;
  return `${type}:${subject.id}`;
};

const emptyGrantForm = (catalog = []) => ({
  profile_id: '',
  access_blocked: false,
  permissions: Object.fromEntries(catalog.map((permission) => [permission.key, false])),
});

export default function AdminPurchasePermissions() {
  const navigate = useNavigate();
  const token = useMemo(() => localStorage.getItem('token'), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [data, setData] = useState({
    catalog: [],
    profiles: [],
    roles: [],
    departments: [],
    users: [],
    grants: [],
    history: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [subjectType, setSubjectType] = useState('user');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [search, setSearch] = useState('');
  const [grantForm, setGrantForm] = useState(() => emptyGrantForm());
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', description: '', permissions: {} });

  const grantsByKey = useMemo(() => {
    const map = new Map();
    data.grants.forEach((grant) => {
      const key = grant.subject_type === 'role'
        ? `role:${grant.subject_key}`
        : `${grant.subject_type}:${grant.subject_id}`;
      map.set(key, grant);
    });
    return map;
  }, [data.grants]);

  const subjects = useMemo(() => {
    if (subjectType === 'role') {
      return data.roles.map((role) => ({ ...role, label: getPerfilLabel(role.id), subtitle: 'Cargo do sistema' }));
    }
    if (subjectType === 'department') {
      return data.departments.map((department) => ({ ...department, label: department.name, subtitle: 'Departamento' }));
    }
    const normalized = search
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return data.users
      .filter((item) => {
        if (!normalized) return true;
        return [item.nome, item.email, item.setor_nome, item.perfil]
          .filter(Boolean)
          .join(' ')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes(normalized);
      })
      .map((item) => ({
        ...item,
        label: item.nome,
        subtitle: `${item.email || ''} · ${item.setor_nome || 'Sem setor'} · ${getPerfilLabel(item.perfil)}`,
      }));
  }, [data.departments, data.roles, data.users, search, subjectType]);

  const selectedSubject = subjects.find((subject) => String(subject.id) === String(selectedSubjectId)) || subjects[0];

  const buildGrantForm = useCallback((subject) => {
    const base = emptyGrantForm(data.catalog);
    if (!subject) return base;

    const grant = grantsByKey.get(grantKey(subjectType, subject));
    const profile = grant?.profile_id
      ? data.profiles.find((item) => Number(item.id) === Number(grant.profile_id))
      : null;
    const profilePermissions = profile?.permissions || {};

    return {
      profile_id: grant?.profile_id ? String(grant.profile_id) : '',
      access_blocked: Boolean(grant?.access_blocked),
      permissions: {
        ...base.permissions,
        ...profilePermissions,
        ...(grant?.permissions || {}),
      },
    };
  }, [data.catalog, data.profiles, grantsByKey, subjectType]);

  const loadData = useCallback(async () => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    try {
      setLoading(true);
      setError('');
      const { data: response } = await api.get('/admin/purchase-permissions', { headers });
      setData({
        catalog: response.catalog || [],
        profiles: response.profiles || [],
        roles: response.roles || [],
        departments: response.departments || [],
        users: response.users || [],
        grants: response.grants || [],
        history: response.history || [],
      });
      const firstUser = response.users?.[0];
      setSelectedSubjectId((current) => current || (firstUser ? String(firstUser.id) : ''));
      const firstProfile = response.profiles?.[0];
      if (firstProfile) {
        setSelectedProfileId(String(firstProfile.id));
        setProfileForm({
          name: firstProfile.name,
          description: firstProfile.description || '',
          permissions: firstProfile.permissions || {},
        });
      }
    } catch (err) {
      console.error('Erro ao carregar permissões de compras:', err);
      if (err.response?.status === 403) {
        setError('Seu usuário não tem permissão para gerenciar compras.');
      } else if (err.response?.status === 404) {
        setError('A API de permissões de compras ainda não está disponível. Reinicie o backend e rode a migration do módulo.');
      } else if (!err.response) {
        setError('Não foi possível conectar ao backend. Verifique se o serviço do chat está rodando.');
      } else {
        setError(err.response?.data?.error || 'Não foi possível carregar as permissões.');
      }
    } finally {
      setLoading(false);
    }
  }, [headers, navigate, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (subjects.length && !subjects.some((subject) => String(subject.id) === String(selectedSubjectId))) {
      setSelectedSubjectId(String(subjects[0].id));
    }
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    setGrantForm(buildGrantForm(selectedSubject));
  }, [buildGrantForm, selectedSubject]);

  const updatePermission = (key, checked) => {
    setGrantForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: checked,
      },
    }));
  };

  const updateProfilePermission = (key, checked) => {
    setProfileForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: checked,
      },
    }));
  };

  const selectProfileForGrant = (profileId) => {
    const profile = data.profiles.find((item) => String(item.id) === String(profileId));
    setGrantForm((current) => ({
      ...current,
      profile_id: profileId,
      permissions: {
        ...emptyGrantForm(data.catalog).permissions,
        ...(profile?.permissions || current.permissions),
      },
    }));
  };

  const saveGrant = async () => {
    if (!selectedSubject) return;
    const endpoint = subjectType === 'role'
      ? `/admin/purchase-permissions/roles/${selectedSubject.id}`
      : subjectType === 'department'
        ? `/admin/purchase-permissions/departments/${selectedSubject.id}`
        : `/admin/purchase-permissions/users/${selectedSubject.id}`;

    try {
      setSaving(true);
      setError('');
      await api.put(endpoint, {
        profile_id: grantForm.profile_id || null,
        access_blocked: grantForm.access_blocked,
        permissions: grantForm.permissions,
      }, { headers });
      setFeedback('Permissões salvas.');
      await loadData();
    } catch (err) {
      console.error('Erro ao salvar permissão:', err);
      setError(err.response?.data?.error || 'Não foi possível salvar permissões.');
    } finally {
      setSaving(false);
    }
  };

  const selectProfileForEdit = (profileId) => {
    const profile = data.profiles.find((item) => String(item.id) === String(profileId));
    setSelectedProfileId(profileId);
    if (profile) {
      setProfileForm({
        name: profile.name,
        description: profile.description || '',
        permissions: { ...emptyGrantForm(data.catalog).permissions, ...(profile.permissions || {}) },
      });
    }
  };

  const saveProfile = async () => {
    if (!selectedProfileId) return;
    try {
      setSaving(true);
      setError('');
      await api.put(`/admin/purchase-permission-profiles/${selectedProfileId}`, profileForm, { headers });
      setFeedback('Perfil atualizado.');
      await loadData();
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      setError(err.response?.data?.error || 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className={adminStyles.page}>
        <div className={adminStyles.loading}>Carregando permissões de compras...</div>
      </main>
    );
  }

  return (
    <main className={adminStyles.page}>
      <header className={adminStyles.header}>
        <div>
          <p className={adminStyles.eyebrow}>Painel administrativo</p>
          <h1>Permissões — Compras e Almoxarifado</h1>
          <p className={adminStyles.subtitle}>
            Defina quem acessa, cria, atende, aprova e visualiza valores no módulo.
          </p>
        </div>
        <div className={adminStyles.headerActions}>
          <button type="button" className={adminStyles.secondaryButton} onClick={() => navigate('/admin')}>
            <ArrowLeft size={17} />
            Voltar ao admin
          </button>
          <button type="button" className={adminStyles.secondaryButton} onClick={() => navigate('/solicitacoes-compras')}>
            Abrir módulo
          </button>
        </div>
      </header>

      {error && <div className={adminStyles.errorBox}>{error}</div>}
      {feedback && <div className={styles.successBox}>{feedback}</div>}

      {!error && (
        <div className={styles.layout}>
          <section className={adminStyles.section}>
            <div className={adminStyles.sectionHeader}>
              <div>
                <h2>Aplicação de permissões</h2>
                <p>Permissões são validadas no backend para cada endpoint.</p>
              </div>
              <button type="button" className={adminStyles.primaryButton} onClick={saveGrant} disabled={saving || !selectedSubject}>
                {saving ? <Loader2 size={16} /> : <Save size={16} />}
                Salvar permissões
              </button>
            </div>

            <div className={styles.subjectTabs}>
              <button type="button" className={subjectType === 'user' ? styles.activeTab : ''} onClick={() => setSubjectType('user')}>
                <Users size={16} />
                Usuários
              </button>
              <button type="button" className={subjectType === 'role' ? styles.activeTab : ''} onClick={() => setSubjectType('role')}>
                Cargos
              </button>
              <button type="button" className={subjectType === 'department' ? styles.activeTab : ''} onClick={() => setSubjectType('department')}>
                Departamentos
              </button>
            </div>

            {subjectType === 'user' && (
              <label className={styles.searchBox}>
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar usuário" />
              </label>
            )}

            <div className={styles.permissionGrid}>
              <aside className={styles.subjectList}>
                {subjects.map((subject) => {
                  const key = grantKey(subjectType, subject);
                  const grant = grantsByKey.get(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={String(selectedSubject?.id) === String(subject.id) ? styles.subjectActive : ''}
                      onClick={() => setSelectedSubjectId(String(subject.id))}
                    >
                      <strong>{subject.label}</strong>
                      <span>{subject.subtitle}</span>
                      {grant?.access_blocked && <small>Bloqueado</small>}
                      {grant?.profile_name && <em>{grant.profile_name}</em>}
                    </button>
                  );
                })}
              </aside>

              <div className={styles.permissionPanel}>
                <div className={styles.selectedHeader}>
                  <div>
                    <span>{subjectType === 'user' ? 'Usuário' : subjectType === 'role' ? 'Cargo' : 'Departamento'}</span>
                    <h3>{selectedSubject?.label || 'Selecione um alvo'}</h3>
                  </div>
                  <label className={styles.blockToggle}>
                    <input
                      type="checkbox"
                      checked={grantForm.access_blocked}
                      onChange={(event) => setGrantForm((current) => ({ ...current, access_blocked: event.target.checked }))}
                    />
                    Bloquear acesso
                  </label>
                </div>

                <label className={styles.profileSelect}>
                  Perfil predefinido
                  <select value={grantForm.profile_id} onChange={(event) => selectProfileForGrant(event.target.value)}>
                    <option value="">Sem perfil</option>
                    {data.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                </label>

                <div className={styles.permissionChecklist}>
                  {data.catalog.map((permission) => (
                    <label key={permission.key}>
                      <input
                        type="checkbox"
                        checked={Boolean(grantForm.permissions?.[permission.key])}
                        onChange={(event) => updatePermission(permission.key, event.target.checked)}
                      />
                      <span>
                        <strong>{permission.label}</strong>
                        <small>{permission.key}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className={styles.sideColumn}>
            <section className={adminStyles.section}>
              <div className={adminStyles.sectionHeader}>
                <div>
                  <h2>Perfis de acesso</h2>
                  <p>Personalize Solicitante, Almoxarifado, Aprovador e Administrador do módulo.</p>
                </div>
              </div>

              <label className={styles.profileSelect}>
                Perfil
                <select value={selectedProfileId} onChange={(event) => selectProfileForEdit(event.target.value)}>
                  {data.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </label>

              <label className={styles.profileSelect}>
                Nome
                <input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className={styles.profileSelect}>
                Descrição
                <textarea rows={3} value={profileForm.description} onChange={(event) => setProfileForm((current) => ({ ...current, description: event.target.value }))} />
              </label>

              <div className={styles.compactChecklist}>
                {data.catalog.map((permission) => (
                  <label key={permission.key}>
                    <input
                      type="checkbox"
                      checked={Boolean(profileForm.permissions?.[permission.key])}
                      onChange={(event) => updateProfilePermission(permission.key, event.target.checked)}
                    />
                    {permission.label}
                  </label>
                ))}
              </div>

              <button type="button" className={adminStyles.primaryButton} onClick={saveProfile} disabled={saving || !selectedProfileId}>
                <ShieldCheck size={16} />
                Salvar perfil
              </button>
            </section>

            <section className={adminStyles.section}>
              <div className={adminStyles.sectionHeader}>
                <div>
                  <h2>Histórico</h2>
                  <p>Auditoria de alterações de acesso.</p>
                </div>
              </div>
              <div className={styles.historyList}>
                {data.history.map((entry) => (
                  <article key={entry.id}>
                    <strong>{entry.action}</strong>
                    <span>{entry.user?.nome || 'Sistema'} · {formatDateTime(entry.created_at)}</span>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
