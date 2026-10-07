import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { RotateCcw, RotateCw, X, ZoomIn } from 'lucide-react';
import styles from '../../styles/Chat.module.css';

const STICKER_OUTPUT_SIZE = 512;

const carregarImagem = (src) => (
  new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = reject;
    imagem.src = src;
  })
);

const grausParaRadiano = (graus) => (graus * Math.PI) / 180;

const obterTamanhoRotacionado = (width, height, rotation) => {
  const rotacao = grausParaRadiano(rotation);

  return {
    width: Math.abs(Math.cos(rotacao) * width) + Math.abs(Math.sin(rotacao) * height),
    height: Math.abs(Math.sin(rotacao) * width) + Math.abs(Math.cos(rotacao) * height),
  };
};

const canvasParaBlob = (canvas) => (
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Nao foi possivel gerar a figurinha.'));
        return;
      }

      resolve(blob);
    }, 'image/webp', 0.9);
  })
);

const gerarStickerBlob = async (src, areaPixels, rotation) => {
  const imagem = await carregarImagem(src);
  const tamanhoRotacionado = obterTamanhoRotacionado(
    imagem.naturalWidth || imagem.width,
    imagem.naturalHeight || imagem.height,
    rotation
  );
  const canvasRotacionado = document.createElement('canvas');
  const contextoRotacionado = canvasRotacionado.getContext('2d');

  canvasRotacionado.width = Math.ceil(tamanhoRotacionado.width);
  canvasRotacionado.height = Math.ceil(tamanhoRotacionado.height);

  contextoRotacionado.imageSmoothingEnabled = true;
  contextoRotacionado.imageSmoothingQuality = 'high';
  contextoRotacionado.translate(canvasRotacionado.width / 2, canvasRotacionado.height / 2);
  contextoRotacionado.rotate(grausParaRadiano(rotation));
  contextoRotacionado.drawImage(
    imagem,
    -(imagem.naturalWidth || imagem.width) / 2,
    -(imagem.naturalHeight || imagem.height) / 2
  );

  const canvasFinal = document.createElement('canvas');
  const contextoFinal = canvasFinal.getContext('2d');

  canvasFinal.width = STICKER_OUTPUT_SIZE;
  canvasFinal.height = STICKER_OUTPUT_SIZE;
  contextoFinal.clearRect(0, 0, STICKER_OUTPUT_SIZE, STICKER_OUTPUT_SIZE);
  contextoFinal.imageSmoothingEnabled = true;
  contextoFinal.imageSmoothingQuality = 'high';
  contextoFinal.drawImage(
    canvasRotacionado,
    Math.max(0, Math.round(areaPixels.x)),
    Math.max(0, Math.round(areaPixels.y)),
    Math.max(1, Math.round(areaPixels.width)),
    Math.max(1, Math.round(areaPixels.height)),
    0,
    0,
    STICKER_OUTPUT_SIZE,
    STICKER_OUTPUT_SIZE
  );

  return canvasParaBlob(canvasFinal);
};

export default function StickerEditorModal({
  image,
  onCancel,
  onConfirm,
  saving = false,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [mode, setMode] = useState('contain');
  const [areaCortada, setAreaCortada] = useState(null);
  const [processing, setProcessing] = useState(false);
  const busy = saving || processing;

  const aoCompletarCorte = useCallback((_, croppedAreaPixels) => {
    setAreaCortada(croppedAreaPixels);
  }, []);

  const confirmar = async () => {
    if (!areaCortada || busy) return;

    try {
      setProcessing(true);
      const blob = await gerarStickerBlob(image.src, areaCortada, rotation);
      await onConfirm?.({
        blob,
        name: `${image.name || 'figurinha'}.webp`,
        mime: 'image/webp',
      });
    } catch (err) {
      console.error('Erro ao preparar figurinha:', err);
      alert('Nao foi possivel preparar esta figurinha.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={styles.stickerEditorOverlay} role="dialog" aria-modal="true">
      <div className={styles.stickerEditorModal}>
        <div className={styles.stickerEditorHeader}>
          <div>
            <strong>Criar figurinha</strong>
            <span>{image.name}</span>
          </div>
          <button
            type="button"
            className={styles.stickerIconButton}
            title="Fechar editor"
            onClick={onCancel}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.stickerCropperArea}>
          <Cropper
            image={image.src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            objectFit={mode === 'contain' ? 'contain' : 'cover'}
            cropShape="rect"
            showGrid={mode === 'square'}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={aoCompletarCorte}
          />
        </div>

        <div className={styles.stickerEditorControls}>
          <div className={styles.stickerSegmentedControl} aria-label="Formato">
            <button
              type="button"
              className={mode === 'contain' ? styles.stickerSegmentActive : ''}
              onClick={() => setMode('contain')}
              disabled={busy}
            >
              Inteira
            </button>
            <button
              type="button"
              className={mode === 'square' ? styles.stickerSegmentActive : ''}
              onClick={() => setMode('square')}
              disabled={busy}
            >
              Quadrada
            </button>
          </div>

          <div className={styles.stickerRotationControls} aria-label="Rotacao">
            <button
              type="button"
              className={styles.stickerIconButton}
              title="Girar para a esquerda"
              onClick={() => setRotation((value) => value - 90)}
              disabled={busy}
            >
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              className={styles.stickerIconButton}
              title="Girar para a direita"
              onClick={() => setRotation((value) => value + 90)}
              disabled={busy}
            >
              <RotateCw size={18} />
            </button>
          </div>

          <label className={styles.stickerZoomControl}>
            <ZoomIn size={16} />
            <input
              type="range"
              min="1"
              max="4"
              step="0.05"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              disabled={busy}
            />
          </label>
        </div>

        <div className={styles.stickerEditorActions}>
          <button
            type="button"
            className={styles.stickerSecondaryButton}
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.stickerPrimaryButton}
            onClick={confirmar}
            disabled={busy}
          >
            {busy ? 'Criando...' : 'Criar figurinha'}
          </button>
        </div>
      </div>
    </div>
  );
}
