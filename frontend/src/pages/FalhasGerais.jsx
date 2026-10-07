import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Gauge,
  Globe2,
  Mail,
  Moon,
  Network,
  Router,
  Search,
  Server,
  ShieldCheck,
  Star,
  Sun,
  Wifi,
} from 'lucide-react';
import { useInternalBack } from '../utils/internalNavigation';
import useTheme from '../utils/useTheme';
import { THEME_DARK, THEME_LIGHT } from '../utils/theme';
import styles from '../styles/FalhasGerais.module.css';

const ICONES_SITES = {
  activity: Activity,
  alert: AlertTriangle,
  gauge: Gauge,
  globe: Globe2,
  mail: Mail,
  network: Network,
  router: Router,
  server: Server,
  shield: ShieldCheck,
  wifi: Wifi,
};

const destaquesPrincipais = [
  {
    id: 'downdetector-destaque',
    nome: 'Downdetector',
    url: 'https://downdetector.com.br/',
    descricao: 'Verificar falhas gerais em serviços como WhatsApp, Instagram, bancos, jogos e plataformas famosas.',
    icon: 'alert',
  },
  {
    id: 'cloudflare-radar-destaque',
    nome: 'Cloudflare Radar',
    url: 'https://radar.cloudflare.com/',
    descricao: 'Monitorar tráfego, interrupções e eventos globais de internet.',
    icon: 'globe',
  },
  {
    id: 'bgp-tools-destaque',
    nome: 'bgp.tools',
    url: 'https://bgp.tools/',
    descricao: 'Consultar ASN, prefixos, rotas BGP e informações de rede.',
    icon: 'network',
  },
  {
    id: 'simet-destaque',
    nome: 'SIMET',
    url: 'https://simet.nic.br/',
    descricao: 'Testar qualidade da conexão, velocidade, latência e estabilidade.',
    icon: 'gauge',
  },
  {
    id: 'mxtoolbox-destaque',
    nome: 'MXToolbox',
    url: 'https://mxtoolbox.com/',
    descricao: 'Consultar DNS, MX, blacklist, SPF e problemas de e-mail.',
    icon: 'mail',
  },
];

const gruposSites = [
  {
    id: 'falhas-gerais',
    titulo: 'Falhas gerais',
    descricao: 'Status de serviços populares e plataformas críticas.',
    icon: AlertTriangle,
    sites: [
      {
        id: 'downdetector',
        nome: 'Downdetector',
        url: 'https://downdetector.com.br/',
        descricao: 'Verificar instabilidades em serviços populares.',
        icon: 'alert',
      },
      {
        id: 'cloudflare-radar',
        nome: 'Cloudflare Radar',
        url: 'https://radar.cloudflare.com/',
        descricao: 'Verificar eventos, tráfego e falhas globais de internet.',
        icon: 'globe',
      },
      {
        id: 'meta-status',
        nome: 'Meta Status',
        url: 'https://metastatus.com/',
        descricao: 'Verificar status de WhatsApp, Instagram, Facebook e ferramentas da Meta.',
        icon: 'activity',
      },
      {
        id: 'google-status',
        nome: 'Google Status',
        url: 'https://www.google.com/appsstatus/dashboard/',
        descricao: 'Verificar Gmail, Drive, Meet, Calendar e serviços Google.',
        icon: 'globe',
      },
      {
        id: 'microsoft-status',
        nome: 'Microsoft Status',
        url: 'https://status.cloud.microsoft/',
        descricao: 'Verificar Outlook, Teams, OneDrive e Microsoft 365.',
        icon: 'server',
      },
    ],
  },
  {
    id: 'diagnostico-cliente',
    titulo: 'Diagnóstico cliente',
    descricao: 'Testes simples para validar qualidade, velocidade e estabilidade.',
    icon: Gauge,
    sites: [
      {
        id: 'simet',
        nome: 'SIMET',
        url: 'https://simet.nic.br/',
        descricao: 'Teste brasileiro de qualidade da internet.',
        icon: 'gauge',
      },
      {
        id: 'brasil-banda-larga',
        nome: 'Brasil Banda Larga',
        url: 'https://www.brasilbandalarga.com.br/',
        descricao: 'Teste de velocidade e qualidade de banda larga.',
        icon: 'wifi',
      },
      {
        id: 'mlab',
        nome: 'M-Lab',
        url: 'https://speed.measurementlab.net/',
        descricao: 'Teste de velocidade, latência e diagnóstico de rede.',
        icon: 'activity',
      },
      {
        id: 'openspeedtest',
        nome: 'OpenSpeedTest',
        url: 'https://openspeedtest.com/',
        descricao: 'Teste rápido de velocidade pelo navegador.',
        icon: 'wifi',
      },
    ],
  },
  {
    id: 'noc-avancado',
    titulo: 'NOC avançado',
    descricao: 'Consulta de ASN, rotas, peers, IXPs e medições distribuídas.',
    icon: Network,
    sites: [
      {
        id: 'bgp-tools',
        nome: 'bgp.tools',
        url: 'https://bgp.tools/',
        descricao: 'Consulta de ASN, BGP, prefixos e peers.',
        icon: 'network',
      },
      {
        id: 'he-bgp',
        nome: 'Hurricane Electric BGP Toolkit',
        url: 'https://bgp.he.net/',
        descricao: 'Consulta pública de BGP, ASN, IPs e rotas.',
        icon: 'router',
      },
      {
        id: 'ripe-atlas',
        nome: 'RIPE Atlas',
        url: 'https://atlas.ripe.net/',
        descricao: 'Medições distribuídas de ping, traceroute e conectividade.',
        icon: 'globe',
      },
      {
        id: 'ripestat',
        nome: 'RIPEstat',
        url: 'https://stat.ripe.net/',
        descricao: 'Consulta de dados de IP, ASN, prefixos e rede.',
        icon: 'network',
      },
      {
        id: 'peeringdb',
        nome: 'PeeringDB',
        url: 'https://www.peeringdb.com/',
        descricao: 'Consulta de redes, IXPs, datacenters e informações de peering.',
        icon: 'server',
      },
    ],
  },
  {
    id: 'dns-email',
    titulo: 'DNS/E-mail',
    descricao: 'Propagação DNS, cache público, registros MX e reputação.',
    icon: Mail,
    sites: [
      {
        id: 'dnschecker',
        nome: 'DNSChecker',
        url: 'https://dnschecker.org/',
        descricao: 'Verificar propagação DNS em vários locais do mundo.',
        icon: 'globe',
      },
      {
        id: 'whatsmydns',
        nome: 'WhatsMyDNS',
        url: 'https://www.whatsmydns.net/',
        descricao: 'Verificar propagação DNS global.',
        icon: 'globe',
      },
      {
        id: 'google-dns-flush',
        nome: 'Google DNS Flush',
        url: 'https://developers.google.com/speed/public-dns/cache',
        descricao: 'Limpar cache DNS público do Google.',
        icon: 'shield',
      },
      {
        id: 'mxtoolbox',
        nome: 'MXToolbox',
        url: 'https://mxtoolbox.com/',
        descricao: 'Consultar DNS, MX, blacklist, SPF e reputação de e-mail.',
        icon: 'mail',
      },
    ],
  },
];

const normalizarTexto = (valor = '') => (
  String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const siteCombinaComBusca = (site, buscaNormalizada) => {
  if (!buscaNormalizada) return true;

  return normalizarTexto(`${site.nome} ${site.descricao} ${site.url}`).includes(buscaNormalizada);
};

function SiteCard({ site, destaque = false }) {
  const Icone = ICONES_SITES[site.icon] || Globe2;

  return (
    <a
      className={`${styles.siteCard} ${destaque ? styles.featuredCard : ''}`}
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className={styles.siteIcon}>
        <Icone size={destaque ? 24 : 20} />
      </span>
      <span className={styles.siteCopy}>
        <span className={styles.siteTopline}>
          <strong>{site.nome}</strong>
          {destaque && (
            <em>
              <Star size={13} />
              Destaque
            </em>
          )}
        </span>
        <span>{site.descricao}</span>
      </span>
      <ExternalLink className={styles.externalIcon} size={18} />
    </a>
  );
}

export default function FalhasGerais({ embedded = false }) {
  const voltarPaginaInterna = useInternalBack('/chat');
  const {
    isLightTheme: temaClaro,
    setTheme: definirTema,
  } = useTheme();
  const [busca, setBusca] = useState('');

  const buscaNormalizada = normalizarTexto(busca.trim());
  const destaquesFiltrados = useMemo(() => (
    destaquesPrincipais.filter((site) => siteCombinaComBusca(site, buscaNormalizada))
  ), [buscaNormalizada]);
  const gruposFiltrados = useMemo(() => (
    gruposSites
      .map((grupo) => ({
        ...grupo,
        sites: grupo.sites.filter((site) => siteCombinaComBusca(site, buscaNormalizada)),
      }))
      .filter((grupo) => grupo.sites.length > 0)
  ), [buscaNormalizada]);
  const totalSites = useMemo(() => (
    new Set(gruposSites.flatMap((grupo) => grupo.sites.map((site) => site.url))).size
  ), []);
  const totalResultados = destaquesFiltrados.length + gruposFiltrados.reduce(
    (total, grupo) => total + grupo.sites.length,
    0
  );
  const semResultados = Boolean(buscaNormalizada) && totalResultados === 0;
  const pageClasses = [
    styles.page,
    embedded ? styles.embeddedPage : '',
    temaClaro ? styles.lightMode : styles.darkMode,
  ].filter(Boolean).join(' ');

  return (
    <main className={pageClasses}>
      <div className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={16} />
          Voltar
        </button>

        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.kicker}>
              <AlertTriangle size={15} />
              Acesso Rápido
            </span>
            <h1>Falhas Gerais</h1>
            <p>Sites úteis para verificar instabilidades, rotas, DNS e qualidade da conexão.</p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.themeSwitch} role="group" aria-label="Escolher modo da página">
              <button
                type="button"
                className={`${styles.themeOption} ${temaClaro ? styles.themeOptionActive : ''}`}
                onClick={() => definirTema(THEME_LIGHT)}
                aria-pressed={temaClaro}
                title="Ativar modo dia"
              >
                <Sun size={15} />
                Dia
              </button>
              <button
                type="button"
                className={`${styles.themeOption} ${!temaClaro ? styles.themeOptionActive : ''}`}
                onClick={() => definirTema(THEME_DARK)}
                aria-pressed={!temaClaro}
                title="Ativar modo noite"
              >
                <Moon size={15} />
                Noite
              </button>
            </div>

            <div className={styles.headerPanel} aria-label="Resumo de sites úteis">
              <strong>{totalSites}</strong>
              <span>sites úteis</span>
            </div>
          </div>
        </header>

        <section className={styles.searchPanel} aria-label="Buscar sites úteis">
          <label className={styles.searchBox}>
            <Search size={18} />
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por DNS, BGP, Google, WhatsApp ou e-mail"
            />
          </label>
          {busca && (
            <button type="button" className={styles.clearButton} onClick={() => setBusca('')}>
              Limpar busca
            </button>
          )}
        </section>

        {semResultados ? (
          <section className={styles.emptyState}>
            <Search size={28} />
            <strong>Nenhum site encontrado.</strong>
            <span>Tente buscar por DNS, BGP, Google, Meta, rota, e-mail ou velocidade.</span>
          </section>
        ) : (
          <>
            {destaquesFiltrados.length > 0 && (
              <section className={styles.featuredSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span>Destaques principais</span>
                    <h2>Consultas mais usadas em incidentes</h2>
                  </div>
                </div>
                <div className={styles.featuredGrid}>
                  {destaquesFiltrados.map((site) => (
                    <SiteCard key={site.id} site={site} destaque />
                  ))}
                </div>
              </section>
            )}

            <div className={styles.groupsList}>
              {gruposFiltrados.map((grupo) => {
                const IconeGrupo = grupo.icon;

                return (
                  <section key={grupo.id} className={styles.groupSection}>
                    <div className={styles.groupHeader}>
                      <span className={styles.groupIcon}>
                        <IconeGrupo size={20} />
                      </span>
                      <div>
                        <h2>{grupo.titulo}</h2>
                        <p>{grupo.descricao}</p>
                      </div>
                    </div>
                    <div className={styles.siteGrid}>
                      {grupo.sites.map((site) => (
                        <SiteCard key={site.id} site={site} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
