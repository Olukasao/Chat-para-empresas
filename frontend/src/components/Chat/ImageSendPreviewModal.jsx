import { useEffect, useMemo, useRef } from 'react';
import styles from '../../styles/Chat.module.css';

export default function ImageSendPreviewModal({
  attachments = [],
  selectedAttachmentId,
  caption = '',
  onCaptionChange,
  onSelectAttachment,
  onRemoveAttachment,
  onAddAttachments,
  onReplaceAttachment,
  onCancel,
  onSend,
  isSending = false,
}) {
  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  const selectedAttachment = useMemo(() => (
    attachments.find((attachment) => attachment.id === selectedAttachmentId) || attachments[0] || null
  ), [attachments, selectedAttachmentId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSending) {
        onCancel?.();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        onSend?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSending, onCancel, onSend]);

  if (!attachments.length || !selectedAttachment) return null;

  const handleAdd = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    onAddAttachments?.(files);
  };

  const handleReplace = (event) => {
    const file = Array.from(event.target.files || [])[0];
    event.target.value = '';

    if (file && selectedAttachment) {
      onReplaceAttachment?.(selectedAttachment.id, file);
    }
  };

  return (
    <div
      className={styles.imageSendModalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Prévia de imagem antes do envio"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSending) {
          onCancel?.();
        }
      }}
    >
      <section className={styles.imageSendModal}>
        <header className={styles.imageSendHeader}>
          <div>
            <strong>Enviar imagem</strong>
            <span>{attachments.length} imagem(ns) pronta(s)</span>
          </div>
          <button
            type="button"
            className={styles.imageSendIconButton}
            onClick={onCancel}
            disabled={isSending}
            title="Cancelar envio"
            aria-label="Cancelar envio"
          >
            ×
          </button>
        </header>

        <div className={styles.imageSendPreviewArea}>
          <img
            src={selectedAttachment.previewUrl}
            alt={selectedAttachment.name || 'Imagem pronta para envio'}
            className={styles.imageSendMainImg}
          />
        </div>

        <div className={styles.imageThumbsRow}>
          {attachments.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              className={`${styles.imageThumbButton} ${
                attachment.id === selectedAttachment.id ? styles.imageThumbButtonActive : ''
              }`}
              onClick={() => onSelectAttachment?.(attachment.id)}
              title={attachment.name || 'Selecionar imagem'}
            >
              <img src={attachment.previewUrl} alt="" className={styles.imageThumb} />
            </button>
          ))}

          <button
            type="button"
            className={styles.imageThumbAdd}
            onClick={() => addInputRef.current?.click()}
            disabled={isSending}
            title="Adicionar imagens"
          >
            +
          </button>
        </div>

        <footer className={styles.imageSendFooter}>
          <div className={styles.imageSendSecondaryActions}>
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              disabled={isSending}
            >
              Trocar
            </button>
            <button
              type="button"
              onClick={() => onRemoveAttachment?.(selectedAttachment.id)}
              disabled={isSending}
            >
              Remover
            </button>
          </div>

          <textarea
            className={styles.imageCaptionInput}
            value={caption}
            onChange={(event) => onCaptionChange?.(event.target.value)}
            placeholder="Escreva uma legenda..."
            disabled={isSending}
            rows={1}
          />

          <button
            type="button"
            className={styles.imageSendButton}
            onClick={onSend}
            disabled={isSending || !attachments.length}
            title="Enviar"
            aria-label="Enviar imagem"
          >
            {isSending ? '...' : '➤'}
          </button>

          <input
            ref={addInputRef}
            type="file"
            accept="image/*"
            multiple
            className={styles.hiddenFileInput}
            onChange={handleAdd}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenFileInput}
            onChange={handleReplace}
          />
        </footer>
      </section>
    </div>
  );
}
