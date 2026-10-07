import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import styles from '../../styles/Chat.module.css';

const carregarImagem = (src) => (
  new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = reject;
    imagem.src = src;
  })
);

const cortarImagem = async (src, areaPixels, mimeType) => {
  const imagem = await carregarImagem(src);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = Math.max(1, Math.round(areaPixels.width));
  canvas.height = Math.max(1, Math.round(areaPixels.height));

  ctx.drawImage(
    imagem,
    areaPixels.x,
    areaPixels.y,
    areaPixels.width,
    areaPixels.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const tipoSaida = mimeType === 'image/png' || mimeType === 'image/webp'
    ? mimeType
    : 'image/jpeg';

  return canvas.toDataURL(tipoSaida, 0.92);
};

export default function ImageCropModal({
  imagem,
  onCancel,
  onConfirm,
  title = 'Editar foto',
  confirmLabel = 'Enviar foto',
  defaultAspect = 4 / 3,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspecto, setAspecto] = useState(defaultAspect);
  const [areaCortada, setAreaCortada] = useState(null);
  const [processando, setProcessando] = useState(false);

  const aoCompletarCorte = useCallback((_, croppedAreaPixels) => {
    setAreaCortada(croppedAreaPixels);
  }, []);

  const confirmar = async () => {
    if (!areaCortada || processando) return;

    try {
      setProcessando(true);
      const imagemCortada = await cortarImagem(
        imagem.src,
        areaCortada,
        imagem.type
      );

      await onConfirm({
        dataUrl: imagemCortada,
        nome: imagem.name,
        mime: imagem.type,
      });
    } catch (err) {
      console.error('Erro ao cortar imagem:', err);
      alert('Não foi possível editar a imagem.');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className={styles.imageEditorOverlay} role="dialog" aria-modal="true">
      <div className={styles.imageEditorModal}>
        <div className={styles.imageEditorHeader}>
          <div>
            <strong>{title}</strong>
            <span>{imagem.name}</span>
          </div>
          <button
            type="button"
            className={styles.photoPreviewClose}
            title="Fechar editor"
            onClick={onCancel}
            disabled={processando}
          >
            ×
          </button>
        </div>

        <div className={styles.cropperArea}>
          <Cropper
            image={imagem.src}
            crop={crop}
            zoom={zoom}
            aspect={aspecto}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={aoCompletarCorte}
            showGrid={false}
          />
        </div>

        <div className={styles.imageEditorControls}>
          <div className={styles.aspectButtons} aria-label="Formato do corte">
            <button
              type="button"
              className={aspecto === 1 ? styles.activeAspect : ''}
              onClick={() => setAspecto(1)}
              disabled={processando}
            >
              1:1
            </button>
            <button
              type="button"
              className={aspecto === 4 / 3 ? styles.activeAspect : ''}
              onClick={() => setAspecto(4 / 3)}
              disabled={processando}
            >
              4:3
            </button>
            <button
              type="button"
              className={aspecto === 16 / 9 ? styles.activeAspect : ''}
              onClick={() => setAspecto(16 / 9)}
              disabled={processando}
            >
              16:9
            </button>
          </div>

          <label className={styles.zoomControl}>
            Zoom
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              disabled={processando}
            />
          </label>
        </div>

        <div className={styles.imageEditorActions}>
          <button
            type="button"
            className={styles.secondaryProfileButton}
            onClick={onCancel}
            disabled={processando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.primaryProfileButton}
            onClick={confirmar}
            disabled={processando}
          >
            {processando ? 'Preparando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
