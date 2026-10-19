// Motions exibidos no card "Novidades" da home.
// Os arquivos em src/motions/web são versões 720p otimizadas para web,
// geradas a partir dos originais em src/motions (que não entram no bundle).
import acessanetV2Video from '../motions/web/acessanet-v2.mp4';
import acessanetV2Poster from '../motions/web/acessanet-v2.jpg';
import agendaVideo from '../motions/web/agenda.mp4';
import agendaPoster from '../motions/web/agenda.jpg';
import anuncioTvVideo from '../motions/web/anuncio-tv.mp4';
import anuncioTvPoster from '../motions/web/anuncio-tv.jpg';
import centralAssinanteVideo from '../motions/web/central-assinante.mp4';
import centralAssinantePoster from '../motions/web/central-assinante.jpg';
import wifiVideo from '../motions/web/vertical.mp4';
import wifiPoster from '../motions/web/vertical.jpg';

export const NOVIDADES_MOTIONS = [
  {
    id: 'acessanet-v2',
    titulo: 'Novo site AcessaNet',
    descricao: 'Cada mundo. Uma conexão.',
    video: acessanetV2Video,
    poster: acessanetV2Poster,
    duracao: 30,
  },
  {
    id: 'agenda',
    titulo: 'Agenda de operações',
    descricao: 'Sua operação está fora de controle?',
    video: agendaVideo,
    poster: agendaPoster,
    duracao: 15,
  },
  {
    id: 'anuncio-tv',
    titulo: 'Anúncio para TV com QR code',
    descricao: 'Chega de esperar pelo suporte.',
    video: anuncioTvVideo,
    poster: anuncioTvPoster,
    duracao: 20,
  },
  {
    id: 'central-assinante',
    titulo: 'Central do Assinante',
    descricao: 'Sua internet evoluiu.',
    video: centralAssinanteVideo,
    poster: centralAssinantePoster,
    duracao: 20,
  },
  {
    id: 'wifi-publico',
    titulo: 'Sua marca no Wi‑Fi público',
    descricao: 'Anúncio na tela de conexão.',
    video: wifiVideo,
    poster: wifiPoster,
    duracao: 10,
    vertical: true,
  },
];
