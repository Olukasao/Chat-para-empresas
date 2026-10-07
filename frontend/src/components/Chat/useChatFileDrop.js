import { useEffect, useRef, useState } from 'react';

const eventoTemArquivos = (event) => (
  Array.from(event.dataTransfer?.types || []).includes('Files')
);

export default function useChatFileDrop(onDropFiles) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    const impedirAberturaArquivo = (event) => {
      if (!eventoTemArquivos(event)) return;
      event.preventDefault();
    };

    const limparArrasteGlobal = (event) => {
      if (!eventoTemArquivos(event)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
    };

    window.addEventListener('dragover', impedirAberturaArquivo);
    window.addEventListener('drop', limparArrasteGlobal);

    return () => {
      window.removeEventListener('dragover', impedirAberturaArquivo);
      window.removeEventListener('drop', limparArrasteGlobal);
    };
  }, []);

  const onDragEnter = (event) => {
    if (!eventoTemArquivos(event)) return;

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };

  const onDragOver = (event) => {
    if (!eventoTemArquivos(event)) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDraggingFiles(true);
  };

  const onDragLeave = (event) => {
    if (!eventoTemArquivos(event)) return;

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false);
    }
  };

  const onDrop = (event) => {
    if (!eventoTemArquivos(event)) return;

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    onDropFiles?.(event.dataTransfer?.files);
  };

  return {
    isDraggingFiles,
    dropHandlers: {
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
    },
  };
}
