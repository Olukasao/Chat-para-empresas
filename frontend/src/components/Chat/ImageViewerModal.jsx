import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../../styles/Chat.module.css';
import baixarArquivo from '../../utils/baixarArquivo';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

export default function ImageViewerModal({
  imageUrl,
  alt = 'Imagem ampliada',
  caption = '',
  images = [],
  currentImageId = null,
  onNavigateImage,
  onClose,
}) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  const normalizedImages = useMemo(() => (
    images
      .map((image, index) => ({
        id: image.id ?? `${image.url || image.imageUrl}-${index}`,
        url: image.url || image.imageUrl || image.mensagem || '',
        alt: image.alt || image.name || alt,
        caption: image.caption || image.legenda || '',
        name: image.name || image.anexo_nome || 'imagem',
      }))
      .filter((image) => image.url)
  ), [alt, images]);

  const currentIndex = useMemo(() => {
    if (!normalizedImages.length) return -1;

    const byId = normalizedImages.findIndex((image) => (
      String(image.id) === String(currentImageId)
    ));

    if (byId >= 0) return byId;

    return normalizedImages.findIndex((image) => image.url === imageUrl);
  }, [currentImageId, imageUrl, normalizedImages]);

  const currentImage = currentIndex >= 0
    ? normalizedImages[currentIndex]
    : {
        id: currentImageId || imageUrl,
        url: imageUrl,
        alt,
        caption,
        name: 'imagem',
      };

  const canNavigate = normalizedImages.length > 1 && currentIndex >= 0;

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const navigateTo = (direction) => {
    if (!canNavigate) return;

    const nextIndex = (currentIndex + direction + normalizedImages.length) % normalizedImages.length;
    resetView();
    onNavigateImage?.(normalizedImages[nextIndex]);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }

      if (event.key === 'ArrowLeft') {
        navigateTo(-1);
      }

      if (event.key === 'ArrowRight') {
        navigateTo(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!currentImage?.url) return null;

  const handleWheel = (event) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    setZoom((current) => clampZoom(current + direction * ZOOM_STEP));
  };

  const handlePointerDown = (event) => {
    if (zoom <= 1) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;

    const nextX = dragRef.current.initialX + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.initialY + event.clientY - dragRef.current.startY;

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  return (
    <div
      className={styles.imageViewerBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Visualização de imagem"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className={styles.imageViewerToolbar}>
        <button type="button" onClick={() => navigateTo(-1)} disabled={!canNavigate} title="Imagem anterior">
          ‹
        </button>
        <button type="button" onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))} title="Aumentar zoom">
          +
        </button>
        <button type="button" onClick={() => setZoom((current) => clampZoom(current - ZOOM_STEP))} title="Diminuir zoom">
          −
        </button>
        <button type="button" onClick={resetView} title="Resetar zoom">
          1:1
        </button>
        <button type="button" onClick={() => baixarArquivo(currentImage.url, currentImage.name || 'imagem')} title="Baixar imagem">
          ⤓
        </button>
        <button type="button" onClick={() => navigateTo(1)} disabled={!canNavigate} title="Próxima imagem">
          ›
        </button>
        <button type="button" onClick={onClose} title="Fechar" aria-label="Fechar">
          ×
        </button>
      </div>

      <div
        className={styles.imageViewerStage}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={currentImage.url}
          alt={currentImage.alt || alt}
          className={styles.imageViewerImage}
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? 'grab' : 'zoom-in',
          }}
        />
      </div>

      {(currentImage.caption || caption || canNavigate) && (
        <footer className={styles.imageViewerCaption}>
          <span>{canNavigate ? `${currentIndex + 1} de ${normalizedImages.length}` : 'Imagem'}</span>
          <p>{currentImage.caption || caption || currentImage.name || ''}</p>
        </footer>
      )}
    </div>
  );
}
