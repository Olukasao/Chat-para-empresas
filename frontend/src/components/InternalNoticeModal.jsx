import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Info,
  Settings,
  ShieldCheck,
  Users,
  Wifi,
  X,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import styles from '../styles/InternalNoticeModal.module.css';

const CHANGE_ICONS = {
  alert: AlertTriangle,
  bell: Bell,
  calendar: CalendarDays,
  check: CheckCircle2,
  info: Info,
  settings: Settings,
  shield: ShieldCheck,
  users: Users,
  wifi: Wifi,
};

const PRIORITY_LABELS = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

const normalizarPrioridade = (priority = 'media') => (
  ['baixa', 'media', 'alta', 'critica'].includes(priority) ? priority : 'media'
);

const renderInlineMarkdown = (text = '') => {
  const value = String(text);

  if (!value.includes('**')) return value;

  const parts = [];
  const boldPattern = /\*\*([\s\S]+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldPattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
    }

    parts.push(<strong key={`bold-${match.index}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }

  return parts.length > 0 ? parts : value;
};

const formatarDataAviso = (valor) => {
  if (!valor) return '';

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';

  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const inicioData = new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
  const diferencaDias = Math.round((inicioHoje - inicioData) / 86400000);

  if (diferencaDias === 0) return 'Hoje';
  if (diferencaDias === 1) return 'Ontem';

  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

function ChangeCard({ item }) {
  const Icone = CHANGE_ICONS[item.icon] || Info;

  return (
    <article className={styles.changeCard}>
      <span className={styles.changeIcon}>
        <Icone size={18} />
      </span>
      <strong>{item.title}</strong>
      <p>{renderInlineMarkdown(item.description)}</p>
    </article>
  );
}

export default function InternalNoticeModal({
  notice,
  actionLoading = '',
  error = '',
  forceCloseButton = false,
  onClose,
  onConfirm,
  onSnooze,
  onOpenDetails,
}) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const imageModalOpenRef = useRef(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const allowClose = Boolean(notice?.allowClose);
  const canCloseModal = allowClose || forceCloseButton;
  const allowSnooze = Boolean(notice?.allowSnooze);
  const requireConfirmation = notice?.requireConfirmation !== false;
  const priority = normalizarPrioridade(notice?.priority);
  const sections = notice?.sections || {};
  const imageUrl = String(notice?.imageUrl || notice?.image_url || '').trim();
  const hasImage = Boolean(imageUrl);
  const changes = Array.isArray(sections.changes) ? sections.changes.slice(0, 3) : [];
  const importantInfo = Array.isArray(sections.importantInfo) ? sections.importantInfo : [];
  const actionRequired = sections.actionRequired || null;
  const hasMainContent = Boolean(sections.resume) || hasImage || changes.length > 0 || importantInfo.length > 0;
  const hasBody = hasMainContent || Boolean(actionRequired);
  const dateLabel = formatarDataAviso(notice?.createdAt || notice?.updatedAt);
  const chips = [
    notice?.type && { id: 'type', label: notice.type },
    { id: 'priority', label: `Prioridade ${PRIORITY_LABELS[priority]}`, priority },
    dateLabel && { id: 'date', label: dateLabel },
    notice?.category && { id: 'category', label: notice.category },
  ].filter(Boolean);

  useEffect(() => {
    imageModalOpenRef.current = imageModalOpen;
  }, [imageModalOpen]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const modal = modalRef.current;

    window.setTimeout(() => {
      closeButtonRef.current?.focus();
      if (!canCloseModal) {
        modal?.querySelector('button:not([disabled]), a[href]')?.focus();
      }
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (imageModalOpenRef.current) {
          event.preventDefault();
          setImageModalOpen(false);
          return;
        }

        if (canCloseModal) {
          event.preventDefault();
          onClose?.();
        }
        return;
      }

      if (event.key !== 'Tab' || !modal) return;

      const focusables = Array.from(
        modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );

      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.classList.add(styles.bodyLocked);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove(styles.bodyLocked);
      previouslyFocused?.focus?.();
    };
  }, [canCloseModal, onClose]);

  if (!notice) return null;

  return (
    <div className={styles.overlay}>
      <section
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="internal-notice-title"
      >
        <div className={styles.header}>
          <span className={styles.noticeIcon}>
            <Info size={26} />
          </span>

          <div className={styles.headerCopy}>
            <div className={styles.headerKicker}>
              <span>AVISO INTERNO</span>
              {notice.isNew && <em>NOVO</em>}
            </div>
            <h2 id="internal-notice-title">{notice.title}</h2>
          </div>

          {canCloseModal && (
            <button
              ref={closeButtonRef}
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label={forceCloseButton ? 'Fechar prévia do aviso' : 'Fechar aviso interno'}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {chips.length > 0 && (
          <div className={styles.chips}>
            {chips.map((chip) => (
              <span
                key={chip.id}
                className={`${styles.chip} ${chip.priority ? styles[`priority${chip.priority}`] : ''}`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}

        {hasBody && (
          <div className={`${styles.body} ${!hasMainContent || !actionRequired ? styles.bodySingle : ''}`}>
            {hasMainContent && (
              <div className={styles.mainColumn}>
                {sections.resume && (
                  <section className={styles.infoCard}>
                    <span className={styles.sectionLabel}>Resumo</span>
                    <p>{renderInlineMarkdown(sections.resume)}</p>
                  </section>
                )}

                {hasImage && (
                  <button
                    type="button"
                    className={styles.noticeImageSpoiler}
                    onClick={() => setImageModalOpen(true)}
                  >
                    <span>
                      <ImageIcon size={16} />
                      Ver imagem do aviso
                    </span>
                    <img src={imageUrl} alt="Prévia da imagem do aviso" />
                  </button>
                )}

                {changes.length > 0 && (
                  <section className={styles.sectionBlock}>
                    <div className={styles.sectionHeader}>
                      <span>O que mudou</span>
                      <strong>{changes.length} item(ns)</strong>
                    </div>
                    <div className={styles.changeGrid}>
                      {changes.map((item, index) => (
                        <ChangeCard key={`${item.title}-${index}`} item={item} />
                      ))}
                    </div>
                  </section>
                )}

                {importantInfo.length > 0 && (
                  <section className={styles.sectionBlock}>
                    <div className={styles.sectionHeader}>
                      <span>Informações importantes</span>
                    </div>
                    <ul className={styles.importantList}>
                      {importantInfo.map((item, index) => (
                        <li key={`${item}-${index}`}>
                          <Check size={16} />
                          <span>{renderInlineMarkdown(item)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}

            {actionRequired && (
              <aside className={styles.actionBox}>
                <span>Ação necessária</span>
                <strong>{actionRequired.title || 'Verificar aviso'}</strong>
                {actionRequired.description && <p>{renderInlineMarkdown(actionRequired.description)}</p>}
              </aside>
            )}
          </div>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        <footer className={styles.footer}>
          {notice.detailUrl && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onOpenDetails}
              disabled={Boolean(actionLoading)}
            >
              <ExternalLink size={16} />
              {notice.detailButtonText || 'Ver detalhes'}
            </button>
          )}

          {allowSnooze && (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={onSnooze}
              disabled={Boolean(actionLoading)}
            >
              {actionLoading === 'snooze' ? 'Salvando...' : 'Lembrar depois'}
            </button>
          )}

          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={Boolean(actionLoading)}
          >
            <CheckCircle2 size={18} />
            {actionLoading === 'confirm'
              ? 'Confirmando...'
              : requireConfirmation ? 'Confirmar leitura' : 'Fechar aviso'}
          </button>

          {notice.createdByName && (
            <span className={styles.noticeAuthor}>
              {String(notice.createdByName).toUpperCase()}
            </span>
          )}
        </footer>
      </section>

      {hasImage && imageModalOpen && (
        <div
          className={styles.imageViewerOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Imagem do aviso"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setImageModalOpen(false);
            }
          }}
        >
          <button
            type="button"
            className={styles.imageViewerClose}
            onClick={() => setImageModalOpen(false)}
            aria-label="Fechar imagem do aviso"
          >
            <X size={22} />
          </button>
          <img src={imageUrl} alt="Imagem do aviso" />
        </div>
      )}
    </div>
  );
}
