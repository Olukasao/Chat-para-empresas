import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import api from '../services/api';
import { PERFIL_ADMIN } from '../utils/perfis';
import styles from '../styles/PlantaoDomingo.module.css';

const PLANTAO_SETORES = [
  { id: 'noc', nome: 'NOC', aliases: [] },
  { id: 'rede', nome: 'Rede', aliases: ['red'] },
  { id: 'cliente', nome: 'Cliente', aliases: [] },
  { id: 'terceiros', nome: 'Terceiros', aliases: [] },
];

const AGENDA_TECNICOS_URL = 'https://192.168.1.133:8500';
const AGENDA_INSTALACAO_URL = 'https://192.168.1.133:8501';

const LINHAS_PADRAO = [
  {
    id: 'domingo-inteiro',
    periodo: 'Domingo',
    horario: 'Dia inteiro',
    setores: PLANTAO_SETORES.map(({ id, nome }) => ({
      id,
      nome,
      pessoas: [],
    })),
    observacoes: '',
  },
];

const criarPlantaoPadrao = () => ({
  titulo: 'Plantão de domingo',
  subtitulo: 'Escala de quem ficará no plantão durante todo o domingo.',
  linhas: LINHAS_PADRAO,
  atualizado_em: null,
  atualizado_por_nome: null,
});

const normalizarPessoaPlantao = (valor, manterVazia = false) => {
  const nome = typeof valor === 'string' ? valor : valor?.nome;
  const texto = String(nome || '');
  return manterVazia ? texto : texto.trim();
};

const obterPessoasLinha = (linha = {}, manterVazias = false) => {
  const pessoas = Array.isArray(linha.pessoas) ? linha.pessoas : [];
  const valores = manterVazias
    ? pessoas
    : [
      ...pessoas,
      linha.responsavel,
      linha.apoio,
    ];

  return valores
    .map((pessoa) => normalizarPessoaPlantao(pessoa, manterVazias))
    .filter((pessoa) => manterVazias || Boolean(pessoa));
};

const normalizarIdSetor = (valor = '') => (
  String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

const obterPessoasSetor = (setor = {}, manterVazias = false) => {
  const pessoas = Array.isArray(setor?.pessoas) ? setor.pessoas : [];

  return pessoas
    .map((pessoa) => normalizarPessoaPlantao(pessoa, manterVazias))
    .filter((pessoa) => manterVazias || Boolean(pessoa));
};

const normalizarSetoresPlantao = (linhas = [], options = {}) => {
  const linhasValidas = Array.isArray(linhas) && linhas.length ? linhas : LINHAS_PADRAO;
  const linhaPrincipal = linhasValidas[0] || LINHAS_PADRAO[0];
  const setoresOrigem = Array.isArray(linhaPrincipal.setores) ? linhaPrincipal.setores : [];
  const setores = PLANTAO_SETORES.map((setorPadrao) => {
    const idsAceitos = [setorPadrao.id, ...(setorPadrao.aliases || [])];
    const origem = setoresOrigem.find((setor) => (
      idsAceitos.includes(normalizarIdSetor(setor?.id || setor?.nome))
    ));

    return {
      id: setorPadrao.id,
      nome: setorPadrao.nome,
      pessoas: options.manterPessoasVazias
        ? obterPessoasSetor(origem, true)
        : [...new Set(obterPessoasSetor(origem))],
    };
  });

  if (!options.manterPessoasVazias) {
    const pessoasLegadas = [...new Set(linhasValidas.flatMap((linha) => obterPessoasLinha(linha)))];
    const setorNoc = setores.find((setor) => setor.id === 'noc');

    if (setorNoc && pessoasLegadas.length) {
      setorNoc.pessoas = [...new Set([...setorNoc.pessoas, ...pessoasLegadas])];
    }
  }

  return setores;
};

const normalizarLinhaPlantao = (linhas = [], options = {}) => {
  const linhasValidas = Array.isArray(linhas) && linhas.length ? linhas : LINHAS_PADRAO;
  const linhaPrincipal = linhasValidas[0] || LINHAS_PADRAO[0];
  const observacoes = linhaPrincipal.observacoes
    || linhasValidas.map((linha) => linha?.observacoes).filter(Boolean).join('\n');

  return {
    ...LINHAS_PADRAO[0],
    setores: normalizarSetoresPlantao(linhasValidas, options),
    observacoes: observacoes || '',
  };
};

const prepararLinhaParaEdicao = (linhas = []) => {
  const linha = normalizarLinhaPlantao(linhas, { manterPessoasVazias: true });

  return {
    ...linha,
    setores: linha.setores.map((setor) => ({
      ...setor,
      pessoas: setor.pessoas.length ? setor.pessoas : [''],
    })),
  };
};

const normalizarPlantao = (data = {}) => {
  const padrao = criarPlantaoPadrao();

  return {
    ...padrao,
    ...data,
    linhas: [normalizarLinhaPlantao(data.linhas)],
  };
};

const prepararPlantaoParaEdicao = (data = {}) => ({
  ...normalizarPlantao(data),
  linhas: [prepararLinhaParaEdicao(data.linhas)],
});

const formatarDataHora = (data) => {
  if (!data) return 'Ainda não atualizado';

  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const obterProximoDomingo = () => {
  const hoje = new Date();
  const domingo = new Date(hoje);
  const diasAteDomingo = (7 - hoje.getDay()) % 7;

  domingo.setDate(hoje.getDate() + diasAteDomingo);

  return domingo.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const obterIniciais = (nome = '') => (
  String(nome)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase() || '?'
);

export default function PlantaoDomingo() {
  const navigate = useNavigate();
  const [plantao, setPlantao] = useState(criarPlantaoPadrao);
  const [form, setForm] = useState(criarPlantaoPadrao);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [agendaMenuAberto, setAgendaMenuAberto] = useState(false);
  const [setorAtivoId, setSetorAtivoId] = useState(PLANTAO_SETORES[0].id);
  const [podeEditarPlantao, setPodeEditarPlantao] = useState(false);
  const agendaMenuRef = useRef(null);

  const token = useMemo(() => localStorage.getItem('token'), []);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);
  const domingoReferencia = useMemo(obterProximoDomingo, []);

  const usuariosUnicos = useMemo(() => {
    const mapa = new Map();

    usuarios.forEach((usuario) => {
      if (usuario?.id) {
        mapa.set(Number(usuario.id), usuario);
      }
    });

    return Array.from(mapa.values()).sort((a, b) => (
      String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
    ));
  }, [usuarios]);

  const carregarPlantao = async () => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      setCarregando(true);
      setErro('');

      const [plantaoRes, usuariosRes, meRes] = await Promise.all([
        api.get('/plantao-domingo', { headers }),
        api.get('/chat/usuarios', { headers }),
        api.get('/me', { headers }),
      ]);

      const plantaoNormalizado = normalizarPlantao(plantaoRes.data);

      setPlantao(plantaoNormalizado);
      setForm(plantaoNormalizado);
      setUsuarios([meRes.data, ...(usuariosRes.data || [])].filter(Boolean));
      setPodeEditarPlantao(meRes.data?.perfil === PERFIL_ADMIN);
    } catch (err) {
      console.error('Erro ao carregar plantão de domingo:', err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
        return;
      }

      setErro(err.response?.data?.error || 'Não foi possível carregar o plantão de domingo.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPlantao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!agendaMenuAberto) return undefined;

    const fecharAgendaAoClicarFora = (event) => {
      if (agendaMenuRef.current?.contains(event.target)) return;
      setAgendaMenuAberto(false);
    };

    document.addEventListener('mousedown', fecharAgendaAoClicarFora);

    return () => {
      document.removeEventListener('mousedown', fecharAgendaAoClicarFora);
    };
  }, [agendaMenuAberto]);

  const abrirEdicao = () => {
    if (!podeEditarPlantao) {
      setErro('Seu usuário não tem permissão para editar o plantão de domingo.');
      return;
    }

    const plantaoEdicao = prepararPlantaoParaEdicao(plantao);

    setForm(plantaoEdicao);
    setSetorAtivoId(plantaoEdicao.linhas[0]?.setores?.[0]?.id || PLANTAO_SETORES[0].id);
    setErro('');
    setModalAberto(true);
  };

  const abrirAgenda = (url) => {
    setAgendaMenuAberto(false);
    window.location.assign(url);
  };

  const fecharModal = () => {
    if (salvando) return;
    setModalAberto(false);
    setForm(prepararPlantaoParaEdicao(plantao));
  };

  const atualizarLinhaPlantao = (campo, valor) => {
    setErro('');
    setForm((atual) => ({
      ...atual,
      linhas: [{ ...normalizarLinhaPlantao(atual.linhas, { manterPessoasVazias: true }), [campo]: valor }],
    }));
  };

  const atualizarPessoaPlantao = (setorId, index, valor) => {
    setErro('');
    setForm((atual) => ({
      ...atual,
      linhas: [{
        ...normalizarLinhaPlantao(atual.linhas, { manterPessoasVazias: true }),
        setores: normalizarLinhaPlantao(atual.linhas, { manterPessoasVazias: true }).setores.map((setor) => (
          setor.id === setorId
            ? {
              ...setor,
              pessoas: setor.pessoas.map((pessoa, pessoaIndex) => (
                pessoaIndex === index ? valor : pessoa
              )),
            }
            : setor
        )),
      }],
    }));
  };

  const adicionarPessoaPlantao = (setorId) => {
    setForm((atual) => ({
      ...atual,
      linhas: [{
        ...normalizarLinhaPlantao(atual.linhas, { manterPessoasVazias: true }),
        setores: normalizarLinhaPlantao(atual.linhas, { manterPessoasVazias: true }).setores.map((setor) => (
          setor.id === setorId ? { ...setor, pessoas: [...setor.pessoas, ''] } : setor
        )),
      }],
    }));
  };

  const removerPessoaPlantao = (setorId, index) => {
    setForm((atual) => ({
      ...atual,
      linhas: [{
        ...normalizarLinhaPlantao(atual.linhas, { manterPessoasVazias: true }),
        setores: normalizarLinhaPlantao(atual.linhas, { manterPessoasVazias: true }).setores.map((setor) => (
          setor.id === setorId
            ? {
              ...setor,
              pessoas: setor.pessoas.filter((_, pessoaIndex) => pessoaIndex !== index).length
                ? setor.pessoas.filter((_, pessoaIndex) => pessoaIndex !== index)
                : [''],
            }
            : setor
        )),
      }],
    }));
  };

  const salvarPlantao = async (event) => {
    event.preventDefault();

    if (!podeEditarPlantao) {
      setErro('Seu usuário não tem permissão para editar o plantão de domingo.');
      return;
    }

    try {
      setSalvando(true);
      setErro('');

      const payload = {
        titulo: form.titulo,
        subtitulo: form.subtitulo,
        linhas: [{
          ...normalizarLinhaPlantao(form.linhas),
          setores: normalizarLinhaPlantao(form.linhas).setores.map((setor) => ({
            ...setor,
            pessoas: setor.pessoas
              .map((pessoa) => pessoa.trim())
              .filter(Boolean),
          })),
        }],
      };

      const { data } = await api.put('/plantao-domingo', payload, { headers });
      const plantaoNormalizado = normalizarPlantao(data);

      setPlantao(plantaoNormalizado);
      setForm(plantaoNormalizado);
      setModalAberto(false);
    } catch (err) {
      console.error('Erro ao salvar plantão de domingo:', err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
        return;
      }

      setErro(err.response?.data?.error || 'Não foi possível salvar o plantão.');
    } finally {
      setSalvando(false);
    }
  };

  const linhaPlantao = normalizarLinhaPlantao(plantao.linhas);
  const linhaForm = prepararLinhaParaEdicao(form.linhas);
  const setorAtivo = linhaForm.setores.find((setor) => setor.id === setorAtivoId)
    || linhaForm.setores[0];
  const setoresPlantao = linhaPlantao.setores;
  const totalPessoasPlantao = setoresPlantao.reduce(
    (total, setor) => total + setor.pessoas.length,
    0
  );

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
            Voltar
          </button>

          <div className={styles.topbarActions}>
            <div
              className={`${styles.agendaMenuWrap} ${agendaMenuAberto ? styles.agendaMenuWrapOpen : ''}`}
              ref={agendaMenuRef}
            >
              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.agendaButton}`}
                onClick={() => setAgendaMenuAberto((atual) => !atual)}
                aria-expanded={agendaMenuAberto}
                aria-haspopup="menu"
              >
                <CalendarDays size={18} />
                Agenda
                <span className={styles.agendaArrow}>→</span>
              </button>

              {agendaMenuAberto && (
                <div className={styles.agendaMenu} role="menu">
                  <button
                    type="button"
                    className={styles.agendaOption}
                    onClick={() => abrirAgenda(AGENDA_TECNICOS_URL)}
                    role="menuitem"
                  >
                    <span>T</span>
                    Agenda técnicos
                  </button>
                  <button
                    type="button"
                    className={styles.agendaOption}
                    onClick={() => abrirAgenda(AGENDA_INSTALACAO_URL)}
                    role="menuitem"
                  >
                    <span>I</span>
                    Agenda instalação
                  </button>
                </div>
              )}
            </div>

            {podeEditarPlantao && (
              <button type="button" className={styles.primaryButton} onClick={abrirEdicao}>
                <Pencil size={18} />
                Editar plantão
              </button>
            )}
          </div>
        </header>

        <section className={styles.headerPanel}>
          <div>
            <span className={styles.kicker}>
              <CalendarDays size={16} />
              {domingoReferencia}
            </span>
            <h1>{plantao.titulo}</h1>
            <p>{plantao.subtitulo}</p>
          </div>

          <div className={styles.statusGrid}>
            <div className={styles.statusItem}>
              <strong>{totalPessoasPlantao}</strong>
              <span>pessoas no plantão</span>
            </div>
            <div className={styles.statusItem}>
              <strong>{formatarDataHora(plantao.atualizado_em)}</strong>
              <span>{plantao.atualizado_por_nome ? `por ${plantao.atualizado_por_nome}` : 'sem editor registrado'}</span>
            </div>
          </div>
        </section>

        {erro && <div className={styles.errorBox}>{erro}</div>}
        {carregando && <div className={styles.loadingBox}>Carregando escala...</div>}

        {!carregando && (
          <section className={styles.sheetPanel} aria-label="Planilha do plantão de domingo">
            <div className={styles.sheetHeader}>
              <div>
                <strong>Escala operacional</strong>
                <span>Plantão separado por setor no domingo inteiro</span>
              </div>
              {podeEditarPlantao && (
                <button type="button" className={styles.secondaryButton} onClick={abrirEdicao}>
                  <Pencil size={16} />
                  Editar
                </button>
              )}
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.sheetTable}>
                <thead>
                  <tr>
                    <th>Setor</th>
                    <th>Horário</th>
                    <th>Pessoas no plantão</th>
                  </tr>
                </thead>
                <tbody>
                  {setoresPlantao.map((setor) => (
                    <tr key={setor.id}>
                      <th scope="row">{setor.nome}</th>
                      <td>
                        <span className={styles.timeCell}>
                          <Clock3 size={14} />
                          {linhaPlantao.horario}
                        </span>
                      </td>
                      <td className={setor.pessoas.length ? styles.peopleCell : styles.emptyCell}>
                        {setor.pessoas.length ? (
                          <div className={styles.plantonistaChips}>
                            {setor.pessoas.map((pessoa) => (
                              <span key={`${setor.id}-${pessoa}`} className={styles.plantonistaChip}>
                                <UserRound size={14} />
                                {pessoa}
                              </span>
                            ))}
                          </div>
                        ) : (
                          'A definir'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.sheetNotes}>
              <strong>Observações</strong>
              <p className={linhaPlantao.observacoes ? '' : styles.emptyCell}>
                {linhaPlantao.observacoes || 'Sem observações'}
              </p>
            </div>
          </section>
        )}

        <section className={styles.peopleStrip}>
          <div>
            <strong>Equipe disponível</strong>
            <span>{usuariosUnicos.length} usuários encontrados no chat interno</span>
          </div>

          <div className={styles.peopleList}>
            {usuariosUnicos.slice(0, 8).map((usuario) => (
              <span key={usuario.id} title={usuario.nome}>
                {usuario.avatar ? (
                  <img src={usuario.avatar} alt="" />
                ) : (
                  obterIniciais(usuario.nome)
                )}
              </span>
            ))}
          </div>
        </section>
      </div>

      {modalAberto && (
        <div className={styles.modalOverlay}>
          <form className={styles.editModal} onSubmit={salvarPlantao}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Editar plantão de domingo</h2>
                <p>Atualize quem ficará no plantão do domingo inteiro.</p>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={fecharModal}
                disabled={salvando}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {erro && <div className={styles.errorBox}>{erro}</div>}

            <datalist id="usuarios-plantao">
              {usuariosUnicos.map((usuario) => (
                <option key={usuario.id} value={usuario.nome} />
              ))}
            </datalist>

            <div className={styles.editorRows}>
              <div className={styles.singleShiftSummary}>
                <Clock3 size={16} />
                <span>{linhaForm.horario}</span>
              </div>

              <div className={styles.sectorEditorShell}>
                <nav className={styles.sectorTabs} aria-label="Setores do plantão">
                  {linhaForm.setores.map((setor) => {
                    const totalSetor = setor.pessoas.filter((pessoa) => pessoa.trim()).length;
                    const ativo = setor.id === setorAtivo?.id;

                    return (
                      <button
                        type="button"
                        key={setor.id}
                        className={`${styles.sectorTab} ${ativo ? styles.sectorTabActive : ''}`}
                        onClick={() => setSetorAtivoId(setor.id)}
                      >
                        <span>{setor.nome}</span>
                        <strong>{totalSetor}</strong>
                      </button>
                    );
                  })}
                </nav>

                <section className={styles.sectorPanel}>
                  <div className={styles.sectorPanelHeader}>
                    <div>
                      <span>Setor</span>
                      <h3>{setorAtivo?.nome}</h3>
                    </div>

                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => adicionarPessoaPlantao(setorAtivo.id)}
                      disabled={salvando}
                    >
                      <Plus size={16} />
                      Adicionar pessoa
                    </button>
                  </div>

                  <div className={styles.personEditorList}>
                    {setorAtivo?.pessoas.map((pessoa, index) => (
                      <label className={styles.personEditorItem} key={`${setorAtivo.id}-pessoa-${index}`}>
                        Pessoa {index + 1}
                        <span>
                          <input
                            type="text"
                            list="usuarios-plantao"
                            value={pessoa}
                            onChange={(event) => atualizarPessoaPlantao(setorAtivo.id, index, event.target.value)}
                            disabled={salvando}
                            placeholder={`Nome no plantão de ${setorAtivo.nome}`}
                          />
                          <button
                            type="button"
                            className={styles.dangerIconButton}
                            onClick={() => removerPessoaPlantao(setorAtivo.id, index)}
                            disabled={salvando}
                            title="Remover pessoa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>

              <section className={styles.editorRow}>
                <div className={styles.editorRowHeader}>
                  <span>
                    <Pencil size={15} />
                    Observações
                  </span>
                </div>

                <div className={styles.editorGrid}>
                  <label className={styles.wideField}>
                    Observações gerais
                    <textarea
                      value={linhaForm.observacoes}
                      onChange={(event) => atualizarLinhaPlantao('observacoes', event.target.value)}
                      disabled={salvando}
                      rows="3"
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className={styles.modalActions}>
              <div className={styles.modalActionsRight}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={fecharModal}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryButton} disabled={salvando}>
                  {salvando ? (
                    'Salvando...'
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar plantão
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
