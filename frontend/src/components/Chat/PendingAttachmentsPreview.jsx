import styles from '../../styles/Chat.module.css';
import { formatAttachmentSize } from './pendingAttachments';

const getAttachmentIcon = (attachment = {}) => {
  if (attachment.kind === 'audio') return '♪';

  const extension = String(attachment.name || '')
    .split('.')
    .pop()
    ?.slice(0, 4)
    ?.toUpperCase();

  return extension && extension !== attachment.name ? extension : 'FILE';
};

export default function PendingAttachmentsPreview({
  attachments = [],
  sending = false,
  onRemove,
}) {
  if (!attachments.length) return null;

  return (
    <div className={styles.pendingAttachmentsPreview} aria-label="Anexos aguardando envio">
      <div className={styles.pendingAttachmentsHeader}>
        <strong>{attachments.length} anexo(s) pronto(s) para envio</strong>
        <span>Revise antes de enviar</span>
      </div>

      <div className={styles.pendingAttachmentsList}>
        {attachments.map((attachment) => (
          <div className={styles.pendingAttachmentItem} key={attachment.id}>
            {attachment.previewUrl ? (
              <img
                src={attachment.previewUrl}
                alt={attachment.name || 'Imagem colada'}
                className={styles.pendingAttachmentThumb}
              />
            ) : (
              <div className={styles.pendingAttachmentFileIcon} aria-hidden="true">
                {getAttachmentIcon(attachment)}
              </div>
            )}

            <div className={styles.pendingAttachmentInfo}>
              <strong>
                {attachment.kind === 'imagem' ? 'Imagem pronta para envio' : 'Arquivo pronto para envio'}
              </strong>
              <span>
                {attachment.name || 'Anexo'}
                {formatAttachmentSize(attachment.size) && ` • ${formatAttachmentSize(attachment.size)}`}
              </span>
            </div>

            <button
              type="button"
              className={styles.pendingAttachmentRemove}
              onClick={() => onRemove?.(attachment.id)}
              disabled={sending}
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
