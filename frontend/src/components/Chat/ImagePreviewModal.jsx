import { useEffect } from 'react';
import styles from '../../styles/Chat.module.css';

export default function ImagePreviewModal({
  imageUrl,
  onClose,
  alt = 'Imagem ampliada',
  ariaLabel = 'Visualização ampliada da imagem',
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!imageUrl) return null;

  return (
    <div
      className={styles.imagePreviewOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <button
        type="button"
        className={styles.imagePreviewClose}
        title="Fechar"
        aria-label="Fechar preview"
        onClick={onClose}
      >
        ×
      </button>

      <div
        className={styles.imagePreviewContent}
        onClick={(event) => event.stopPropagation()}
      >
        <img src={imageUrl} alt={alt} />
      </div>
    </div>
  );
}
