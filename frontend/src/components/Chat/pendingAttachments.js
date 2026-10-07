export const isImageFile = (file) => (
  Boolean(file) && String(file.type || '').toLowerCase().startsWith('image/')
);

export const formatAttachmentSize = (bytes = 0) => {
  const size = Number(bytes || 0);

  if (!size) return '';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;

  return `${size} B`;
};

export const createPendingAttachments = (files = [], resolveMetadata = () => ({})) => (
  Array.from(files)
    .filter(Boolean)
    .map((entry, index) => {
      const file = entry?.file || entry;
      const { file: _ignoredFile, ...entryMetadata } = entry?.file ? entry : {};
      const metadata = {
        ...entryMetadata,
        ...(resolveMetadata(file, index) || {}),
      };
      const isImage = metadata.kind === 'imagem' || isImageFile(file);

      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name || (isImage ? 'Imagem colada' : 'Arquivo anexado'),
        mime: file.type || metadata.mime || 'application/octet-stream',
        size: file.size || 0,
        kind: isImage ? 'imagem' : (metadata.kind || 'arquivo'),
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        ...metadata,
      };
    })
);

export const revokePendingAttachmentPreviews = (attachments = []) => {
  attachments.forEach((attachment) => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  });
};
