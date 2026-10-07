import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  Repeat2,
  Route,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import styles from "../../styles/ControleOperacional.module.css";

const cards = [
  { key: "chamados_movimentados", label: "Chamados", Icone: Wrench },
  { key: "instalacoes_movimentadas", label: "Instalações", Icone: Route },
  { key: "reagendamentos", label: "Reagendamentos", Icone: CalendarClock },
  { key: "transferencias_tecnico", label: "Transferências", Icone: Repeat2 },
  { key: "chamados_concluidos", label: "Concluídos", Icone: CheckCircle2 },
  { key: "alteracoes_agenda", label: "Agenda", Icone: CalendarClock },
  { key: "ausencias", label: "Ausências", Icone: UserCheck },
  { key: "mensagens_enviadas", label: "Mensagens", Icone: MessageSquare },
  { key: "usuarios_ativos", label: "Usuários ativos", Icone: Users },
  { key: "eventos_criticos", label: "Críticos", Icone: AlertTriangle, critical: true },
];

export default function OperationalStats({ resumo, loading }) {
  return (
    <section className={styles.statsGrid} aria-label="Resumo operacional">
      {cards.map((card) => {
        const Icon = card.Icone;

        return (
          <article className={`${styles.statCard} ${card.critical ? styles.statCritical : ""}`} key={card.key}>
            <span className={styles.statIcon}>
              <Icon size={18} />
            </span>
            <strong>{loading ? "..." : (resumo?.[card.key] ?? 0)}</strong>
            <span>{card.label}</span>
          </article>
        );
      })}
    </section>
  );
}
