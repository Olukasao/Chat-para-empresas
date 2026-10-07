export default async function baixarArquivo(url, nomeArquivo = 'arquivo') {
  const nome = nomeArquivo || 'arquivo';

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = blobUrl;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);

    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
