import { Filter, RefreshCw, Search, X } from "lucide-react";
import styles from "../../styles/ControleOperacional.module.css";

const periodos = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];

const tipos = [
  { value: "", label: "Todos" },
  { value: "manutencao", label: "Manutenção" },
  { value: "instalacao", label: "Instalação" },
  { value: "agenda", label: "Agenda" },
  { value: "ausencias", label: "Ausências" },
  { value: "chat", label: "Chat" },
  { value: "usuarios", label: "Usuários" },
  { value: "sistema", label: "Sistema" },
];

const niveis = [
  { value: "", label: "Todos os níveis" },
  { value: "normal", label: "Normal" },
  { value: "important", label: "Importante" },
  { value: "critical", label: "Crítico" },
];

export default function AuditFilters({ filtros, onChange, onRefresh, onClear, refreshing }) {
  const alterar = (campo) => (event) => {
    onChange({ ...filtros, [campo]: event.target.value });
  };

  return (
    <section className={styles.filtersBand} aria-label="Filtros do feed">
      <div className={styles.filtersTitle}>
        <Filter size={18} />
        <strong>Filtros</strong>
      </div>

      <div className={styles.filtersGrid}>
        <label>
          Período
          <select value={filtros.periodo} onChange={alterar("periodo")}>
            {periodos.map((periodo) => (
              <option key={periodo.value} value={periodo.value}>{periodo.label}</option>
            ))}
          </select>
        </label>

        <label>
          Tipo
          <select value={filtros.tipo} onChange={alterar("tipo")}>
            {tipos.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </select>
        </label>

        <label>
          Usuário
          <input value={filtros.usuario} onChange={alterar("usuario")} placeholder="ID ou nome" />
        </label>

        <label>
          Técnico
          <input value={filtros.tecnico} onChange={alterar("tecnico")} placeholder="Nome do técnico" />
        </label>

        <label>
          Ação
          <input value={filtros.acao} onChange={alterar("acao")} placeholder="TRANSFERIR_CHAMADO" />
        </label>

        <label>
          Nível
          <select value={filtros.nivel} onChange={alterar("nivel")}>
            {niveis.map((nivel) => (
              <option key={nivel.value} value={nivel.value}>{nivel.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.searchFilter}>
          Pesquisa no feed
          <span>
            <Search size={16} />
            <input value={filtros.search} onChange={alterar("search")} placeholder="Chamado, texto ou evento" />
          </span>
        </label>
      </div>

      <div className={styles.filterActions}>
        <button type="button" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={16} />
          Atualizar
        </button>
        <button type="button" onClick={onClear}>
          <X size={16} />
          Limpar
        </button>
      </div>
    </section>
  );
}
