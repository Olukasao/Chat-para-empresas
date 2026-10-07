import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  HelpCircle,
  ExternalLink,
  FileText,
  FileUp,
  KanbanSquare,
  Loader2,
  MessageSquareText,
  PackageCheck,
  PackageSearch,
  Paperclip,
  Plus,
  Receipt,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import api from '../services/api';
import { socket } from '../services/socket';
import styles from '../styles/PurchaseRequests.module.css';

const STATUS_LABELS = {
  rascunho: 'Rascunho',
  aguardando_almoxarifado: 'Aguardando almoxarifado',
  em_analise: 'Em análise',
  aguardando_informacoes: 'Aguardando informações',
  em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovada_para_compra: 'Aprovada para compra',
  compra_realizada: 'Compra realizada',
  recebida_parcialmente: 'Recebida parcialmente',
  concluida: 'Concluída',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
};

const ITEM_STATUS_LABELS = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  aguardando_informacoes: 'Aguardando informações',
  em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  comprado: 'Comprado',
  recebido_parcialmente: 'Recebido parcialmente',
  recebido: 'Recebido',
  disponivel_estoque: 'Disponível em estoque',
  rejeitado: 'Rejeitado',
  cancelado: 'Cancelado',
};

const REQUEST_TYPE_LABELS = {
  normal: 'Solicitação normal',
  urgente: 'Solicitação urgente',
  mensal: 'Solicitação mensal',
};

const RECEIPT_CONDITION_LABELS = {
  correto: 'Material correto',
  incorreto: 'Material incorreto',
  danificado: 'Material danificado',
  quantidade_incompleta: 'Quantidade incompleta',
};

const KANBAN_COLUMNS = [
  'aguardando_almoxarifado',
  'em_analise',
  'aguardando_informacoes',
  'em_cotacao',
  'aguardando_aprovacao',
  'aprovada_para_compra',
  'compra_realizada',
  'recebida_parcialmente',
  'concluida',
];

const FINAL_REQUEST_STATUSES = ['concluida', 'rejeitada', 'cancelada'];
const OPEN_REQUEST_STATUSES = [
  'aguardando_almoxarifado',
  'em_analise',
  'aguardando_informacoes',
  'em_cotacao',
  'aguardando_aprovacao',
  'aprovada_para_compra',
  'compra_realizada',
  'recebida_parcialmente',
];

const DEFAULT_FILTERS = {
  q: '',
  status: '',
  department_id: '',
  priority: '',
  requester_id: '',
  assigned_user_id: '',
  supplier_id: '',
  purchase_status: '',
  receipt_status: '',
  start_date: '',
  end_date: '',
  monthly: false,
  urgent: false,
  overdue: false,
  open: false,
  receipt_date: '',
  has_quotes: false,
};

const DASHBOARD_FILTER_RESET = {
  open: false,
  receipt_date: '',
  has_quotes: false,
  overdue: false,
};

const SEARCH_TYPE_LABELS = {
  item: 'Produto',
  request: 'Pedido',
  supplier: 'Fornecedor',
};

const PURCHASE_SITUATION_LABELS = {
  sem_compra: 'Sem compra',
  com_compra: 'Com compra',
  compra_parcial: 'Compra parcial',
  compra_total: 'Compra total',
};

const RECEIPT_SITUATION_LABELS = {
  sem_recebimento: 'Sem recebimento',
  recebimento_parcial: 'Recebimento parcial',
  recebido_total: 'Recebido total',
};

const PURCHASE_PANEL_ROUTE = '/painel-almoxarifado';
const PANEL_QUERY_VALUE = 'pedidos';
const BOOLEAN_FILTER_KEYS = ['monthly', 'urgent', 'overdue', 'open', 'has_quotes'];
const TEXT_FILTER_KEYS = [
  'q',
  'status',
  'department_id',
  'priority',
  'requester_id',
  'assigned_user_id',
  'supplier_id',
  'purchase_status',
  'receipt_status',
  'start_date',
  'end_date',
  'receipt_date',
  'needed_at',
  'category_id',
];

const isTruthyQueryValue = (value) => ['1', 'true', 'sim', 'yes'].includes(String(value || '').toLowerCase());

const buildPanelSearch = (filters = DEFAULT_FILTERS, requestId = null) => {
  const params = new URLSearchParams();
  params.set('panel', PANEL_QUERY_VALUE);

  TEXT_FILTER_KEYS.forEach((key) => {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value));
    }
  });

  BOOLEAN_FILTER_KEYS.forEach((key) => {
    if (filters[key]) params.set(key, '1');
  });

  if (requestId) params.set('request_id', String(requestId));

  return params.toString();
};

const parsePanelSearch = (search = '') => {
  const params = new URLSearchParams(search);
  const hasPanelQuery = params.get('panel') === PANEL_QUERY_VALUE
    || params.has('request_id')
    || TEXT_FILTER_KEYS.some((key) => params.has(key))
    || BOOLEAN_FILTER_KEYS.some((key) => params.has(key));

  if (!hasPanelQuery) {
    return { shouldOpen: false, filters: DEFAULT_FILTERS, requestId: null };
  }

  const filters = { ...DEFAULT_FILTERS };
  TEXT_FILTER_KEYS.forEach((key) => {
    if (params.has(key)) filters[key] = params.get(key) || '';
  });
  BOOLEAN_FILTER_KEYS.forEach((key) => {
    if (params.has(key)) filters[key] = isTruthyQueryValue(params.get(key));
  });

  const requestId = Number(params.get('request_id') || 0);
  return {
    shouldOpen: true,
    filters,
    requestId: Number.isInteger(requestId) && requestId > 0 ? requestId : null,
  };
};

const buildRequestSearchParams = (filters = DEFAULT_FILTERS) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value === true ? '1' : value);
  });
  return params;
};

const OPEN_PURCHASE_GROUPS = [
  {
    key: 'aguardando_aprovacao',
    label: 'Aguardando aprovação',
    statuses: ['aguardando_aprovacao'],
    color: '#F5A623',
  },
  {
    key: 'em_cotacao',
    label: 'Aguardando cotação',
    statuses: ['em_cotacao'],
    color: '#3BD98A',
  },
  {
    key: 'aguardando_emissao',
    label: 'Aguardando emissão',
    statuses: ['aprovada_para_compra'],
    color: '#8B5CF6',
  },
  {
    key: 'em_andamento',
    label: 'Em andamento',
    statuses: ['aguardando_almoxarifado', 'em_analise', 'aguardando_informacoes', 'compra_realizada', 'recebida_parcialmente'],
    color: '#12C6F4',
  },
];

const RECEIPT_STATUS_LABELS = {
  agendado: 'Agendado',
  em_transito: 'Em trânsito',
  recebido: 'Recebido',
};

const DEFAULT_DASHBOARD = {
  indicators: {},
  by_status: {},
  open_requests: { total: 0, items: [] },
  open_purchases: { total_orders: 0, total_value: null, groups: [] },
  daily_receipts: { total_receipts: 0, total_value: null, items: [] },
  lead_time: { average_days: null, previous_average_days: null },
  top_requested_items: [],
  quotation_comparison: [],
  critical_items: [],
  data_gaps: {},
};

const DEFAULT_OPTIONS = {
  statuses: Object.keys(STATUS_LABELS),
  item_statuses: Object.keys(ITEM_STATUS_LABELS),
  request_types: Object.keys(REQUEST_TYPE_LABELS),
  units: ['unidade', 'caixa', 'pacote', 'metro', 'rolo', 'quilograma', 'litro', 'outro'],
  quote_statuses: ['aguardando_retorno', 'selecionada', 'descartada'],
  receipt_conditions: Object.keys(RECEIPT_CONDITION_LABELS),
  upload_limit_mb: 50,
  categories: [],
  suppliers: [],
  users: [],
  departments: [],
  permissions: {},
};

const createEmptyItem = () => ({
  description: '',
  category_name: '',
  stock_quantity: '',
  requested_quantity: '1',
  unit: 'unidade',
  reference_url: '',
  estimated_unit_price: '',
  brand: '',
  model: '',
  requester_notes: '',
  purchase_reason: '',
  file: null,
});

const createEmptyRequestForm = (user = {}) => ({
  request_type: 'normal',
  needed_at: '',
  justification: '',
  notes: '',
  department_id: user?.setor_id ? String(user.setor_id) : '',
  department_name: user?.setor_nome || user?.department_name || '',
  cost_center: '',
  company_unit: user?.empresa_nome || '',
  attachments: [],
  items: [createEmptyItem()],
});

const createActionForm = (type, item = {}) => {
  if (type === 'quote') {
    return {
      supplier_name: '',
      cnpj: '',
      seller_name: '',
      phone: '',
      email: '',
      link: '',
      quantity: item.requested_quantity || 1,
      unit_price: '',
      shipping_price: '',
      discount: '',
      delivery_days: '',
      valid_until: '',
      payment_method: '',
      status: 'aguardando_retorno',
      discard_reason: '',
      notes: '',
      files: [],
    };
  }

  if (type === 'purchase') {
    return {
      supplier_name: item.supplier?.name || '',
      quote_id: '',
      quantity: Math.max(1, Number(item.requested_quantity || 1) - Number(item.purchased_quantity || 0)),
      unit_price: item.unit_price || item.estimated_unit_price || '',
      shipping_price: '',
      discount: '',
      order_number: '',
      purchase_date: new Date().toISOString().slice(0, 10),
      expected_delivery_at: '',
      payment_method: '',
      notes: '',
      files: [],
    };
  }

  return {
    quantity_received: Math.max(1, Number(item.purchased_quantity || item.requested_quantity || 1) - Number(item.received_quantity || 0)),
    condition_status: 'correto',
    storage_location: '',
    received_at: new Date().toISOString().slice(0, 10),
    notes: '',
    files: [],
  };
};

const getLocalUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const formatDate = (value) => {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleDateString('pt-BR');
};

const formatDateTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMoney = (value) => {
  if (value === null || value === undefined) return 'Restrito';
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const formatCompactMoney = (value) => {
  if (value === null || value === undefined) return 'Restrito';
  const number = Number(value || 0);
  if (Math.abs(number) >= 1000000) return `${formatMoney(number / 1000000).replace('R$', 'R$ ')} mi`;
  if (Math.abs(number) >= 1000) return `${formatMoney(number / 1000).replace('R$', 'R$ ')} mil`;
  return formatMoney(number);
};

const formatQuantity = (value, suffix = '') => {
  const number = Number(value || 0);
  const formatted = Number.isInteger(number)
    ? number.toLocaleString('pt-BR')
    : number.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return suffix ? `${formatted} ${suffix}` : formatted;
};

const getInitials = (name = '') => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
};

const getUserSubtitle = (user = {}) => (
  user?.setor_nome || user?.department_name || user?.empresa_nome || user?.perfil || 'Equipe'
);

const isFinalRequestStatus = (status) => FINAL_REQUEST_STATUSES.includes(status);
const isOpenRequestStatus = (status) => OPEN_REQUEST_STATUSES.includes(status);

const getTodayInputValue = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const getItemDisplayName = (item = {}) => (
  item?.name
  || item?.item_name
  || item?.item_nome
  || item?.produto_nome
  || item?.first_item_description
  || item?.item_description
  || item?.description
  || item?.descricao
  || item?.summary
  || 'Item sem nome'
);

const getRequestDisplayName = (request = {}) => (
  request?.summary
  || request?.first_item_description
  || request?.item_name
  || request?.item_description
  || request?.justification
  || request?.notes
  || 'Item sem nome'
);

const getApiErrorMessage = (err, fallback) => {
  const responseError = err?.response?.data?.error;
  if (responseError) return responseError;
  if (err?.response?.status) return `${fallback} Código HTTP ${err.response.status}.`;
  if (err?.message) return `${fallback} ${err.message}.`;
  return fallback;
};

const getRequestValue = (request = {}) => {
  if (request.actual_total !== null && request.actual_total !== undefined && Number(request.actual_total) > 0) {
    return Number(request.actual_total || 0);
  }
  if (request.estimated_total !== null && request.estimated_total !== undefined) {
    return Number(request.estimated_total || 0);
  }
  return 0;
};

const buildOpenGroupsFromRequests = (requests = [], canViewFinancial = false) => {
  const openRequests = requests.filter((request) => isOpenRequestStatus(request.status));
  return OPEN_PURCHASE_GROUPS.map((group) => {
    const groupRequests = openRequests.filter((request) => group.statuses.includes(request.status));
    return {
      key: group.key,
      total_orders: groupRequests.length,
      total_value: canViewFinancial
        ? groupRequests.reduce((total, request) => total + getRequestValue(request), 0)
        : null,
    };
  });
};

const getGroupConfig = (key) => OPEN_PURCHASE_GROUPS.find((group) => group.key === key) || OPEN_PURCHASE_GROUPS[3];

const buildDonutGradient = (groups = [], total = 0) => {
  if (!total) return 'conic-gradient(rgba(94, 160, 210, 0.18) 0 100%)';

  let cursor = 0;
  const segments = groups
    .filter((group) => Number(group.total_orders || 0) > 0)
    .map((group) => {
      const value = Number(group.total_orders || 0);
      const start = cursor;
      const end = cursor + (value / total) * 100;
      cursor = end;
      return `${getGroupConfig(group.key).color} ${start}% ${end}%`;
    });

  return `conic-gradient(${segments.join(', ')})`;
};

const normalizeDashboard = (data = {}) => ({
  ...DEFAULT_DASHBOARD,
  ...(data || {}),
  open_purchases: {
    ...DEFAULT_DASHBOARD.open_purchases,
    ...(data?.open_purchases || {}),
  },
  open_requests: {
    ...DEFAULT_DASHBOARD.open_requests,
    ...(data?.open_requests || {}),
    items: Array.isArray(data?.open_requests?.items) ? data.open_requests.items : [],
  },
  daily_receipts: {
    ...DEFAULT_DASHBOARD.daily_receipts,
    ...(data?.daily_receipts || {}),
    items: Array.isArray(data?.daily_receipts?.items) ? data.daily_receipts.items : [],
  },
  lead_time: {
    ...DEFAULT_DASHBOARD.lead_time,
    ...(data?.lead_time || {}),
  },
  top_requested_items: Array.isArray(data?.top_requested_items) ? data.top_requested_items : [],
  quotation_comparison: Array.isArray(data?.quotation_comparison) ? data.quotation_comparison : [],
  critical_items: Array.isArray(data?.critical_items) ? data.critical_items : [],
  data_gaps: data?.data_gaps || {},
});

const formatFileSize = (bytes = 0) => {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
};

const hasRequestQuantity = (request = {}) => {
  const value = request.requested_quantity ?? request.first_item_requested_quantity;
  return value !== null && value !== undefined && String(value).trim() !== '';
};

const getRequestQuantityLabel = (request = {}) => {
  if (hasRequestQuantity(request)) {
    return formatQuantity(request.requested_quantity ?? request.first_item_requested_quantity, request.unit || request.first_item_unit || '');
  }
  return `${request.items_count || 0} item(ns)`;
};

const resolveMediaUrl = (url = '') => {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('uploads/')) return resolveMediaUrl(`/${value}`);

  const apiBaseUrl = String(api.defaults.baseURL || '').replace(/\/$/, '');
  if (value.startsWith('/uploads/') && apiBaseUrl && apiBaseUrl !== '/api') {
    return `${apiBaseUrl.replace(/\/api$/, '')}${value}`;
  }

  return value;
};

const getImageUrlFromSource = (source = {}) => {
  if (typeof source === 'string') return source;
  if (!source || typeof source !== 'object') return '';
  return source.url
    || source.file_url
    || source.image_url
    || source.imagem_url
    || source.foto_url
    || source.imageUrl
    || source.item_image_url
    || source.imagem
    || source.foto
    || '';
};

const getImageNameFromSource = (source = {}) => {
  if (!source || typeof source !== 'object') return '';
  return source.name
    || source.file_name
    || source.image_name
    || source.item_image_name
    || source.nome
    || '';
};

const getRequestItemImage = (request = {}) => {
  const sources = [
    request.item_image,
    request.itemImage,
    request.thumbnail,
    request.image,
    request.imagem,
    request.foto,
    request,
  ];

  for (const source of sources) {
    const url = getImageUrlFromSource(source);
    if (url) {
      return {
        url: resolveMediaUrl(url),
        name: getImageNameFromSource(source) || request.item_image_name || getRequestDisplayName(request),
      };
    }
  }

  return null;
};

const hasPermission = (permissions = {}, permission) => Boolean(permissions?.[permission]);

function LoadingSkeleton() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topHeader}>
          <div className={styles.headerTitleGroup}>
            <span className={`${styles.skeleton} ${styles.skeletonIcon}`} />
            <div>
              <span className={`${styles.skeleton} ${styles.skeletonLineSmall}`} />
              <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
            </div>
          </div>
          <span className={`${styles.skeleton} ${styles.skeletonSearch}`} />
          <span className={`${styles.skeleton} ${styles.skeletonButton}`} />
        </header>
        <section className={styles.kpiGrid}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div className={styles.kpiCard} key={`kpi-skeleton-${index}`}>
              <span className={`${styles.skeleton} ${styles.skeletonIcon}`} />
              <span className={`${styles.skeleton} ${styles.skeletonLineSmall}`} />
              <span className={`${styles.skeleton} ${styles.skeletonNumber}`} />
            </div>
          ))}
        </section>
        <div className={styles.dashboardMainRow}>
          <section className={styles.dashboardCard}>
            <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
            <span className={`${styles.skeleton} ${styles.skeletonTable}`} />
          </section>
          <section className={styles.dashboardCard}>
            <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
            <span className={`${styles.skeleton} ${styles.skeletonTable}`} />
          </section>
        </div>
      </div>
    </main>
  );
}

function EmptyState({ icon: Icon = PackageCheck, title, text }) {
  return (
    <div className={styles.emptyState}>
      {createElement(Icon, { size: 32 })}
      <strong>{title}</strong>
      {text && <span>{text}</span>}
    </div>
  );
}

function KpiCard({ icon: Icon, title, value, subtitle, accent = 'cyan', footer, onClick }) {
  const Component = onClick ? 'button' : 'article';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={`${styles.kpiCard} ${styles[`accent_${accent}`] || ''}`}
      onClick={onClick}
    >
      <span className={styles.kpiIcon}>{createElement(Icon, { size: 24 })}</span>
      <span className={styles.kpiLabel}>{title}</span>
      <strong>{value}</strong>
      <small>{subtitle}</small>
      {footer && <span className={styles.kpiFooter}>{footer}</span>}
    </Component>
  );
}

function RequestItemThumbnail({ request, fallbackIcon: Icon = PackageSearch }) {
  const image = getRequestItemImage(request);
  const [failedUrl, setFailedUrl] = useState('');
  const imageUrl = image?.url && failedUrl !== image.url ? image.url : '';

  if (imageUrl) {
    return (
      <span className={styles.itemThumbnail}>
        <img
          src={imageUrl}
          alt={image?.name ? `Imagem do item ${image.name}` : `Imagem do item ${getRequestDisplayName(request)}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(imageUrl)}
        />
      </span>
    );
  }

  return (
    <span className={`${styles.itemThumbnail} ${styles.itemThumbnailFallback}`} aria-hidden="true">
      {createElement(Icon, { size: 21 })}
    </span>
  );
}

function DashboardCard({ title, icon: Icon, actionLabel, onAction, extraActions = null, children }) {
  return (
    <section className={styles.dashboardCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>{Icon && <Icon size={18} />} {title}</h2>
        </div>
        {(extraActions || actionLabel) && (
          <div className={styles.sectionActions}>
            {extraActions}
            {actionLabel && (
              <button type="button" className={styles.textButton} onClick={onAction}>
                {actionLabel}
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function ExportMenu({ open, exportingKey, onToggle, onExport }) {
  const isExporting = Boolean(exportingKey);
  return (
    <div className={styles.exportMenu}>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={onToggle}
        disabled={isExporting}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isExporting ? <Loader2 size={15} /> : <Download size={15} />}
        Exportar Excel
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className={styles.exportMenuPopover} role="menu">
          <button type="button" role="menuitem" onClick={() => onExport('open')}>
            <Download size={14} />
            Exportar pedidos em aberto
          </button>
          <button type="button" role="menuitem" onClick={() => onExport('cancelled')}>
            <Download size={14} />
            Exportar pedidos cancelados
          </button>
          <button type="button" role="menuitem" onClick={() => onExport('all')}>
            <Download size={14} />
            Exportar todos os pedidos
          </button>
          <button type="button" role="menuitem" onClick={() => onExport('filtered')}>
            <Download size={14} />
            Exportar resultado filtrado
          </button>
        </div>
      )}
    </div>
  );
}

function OpenRequestsCard({ requests, total, onOpenRequest, onViewAll, exportActions = null }) {
  return (
    <DashboardCard
      title="Pedidos em aberto"
      icon={ClipboardList}
      actionLabel="Ver todos os pedidos"
      onAction={onViewAll}
      extraActions={exportActions}
    >
      {requests.length ? (
        <div className={styles.openRequestsList}>
          {requests.slice(0, 5).map((request) => (
            <button
              type="button"
              key={request.id || request.request_id}
              className={`${styles.openRequestItem} ${request.priority === 'urgente' ? styles.openRequestUrgent : ''}`}
              onClick={() => onOpenRequest(request)}
            >
              <RequestItemThumbnail request={request} fallbackIcon={PackageSearch} />
              <span className={styles.openRequestMain}>
                <strong>{getItemDisplayName(request)}</strong>
                <small>
                  {getRequestQuantityLabel(request)}
                  {hasRequestQuantity(request) && Number(request.items_count || 0) > 1 ? ` · +${Number(request.items_count || 0) - 1} item(ns)` : ''}
                </small>
                <small>{request.code ? `Pedido ${request.code}` : 'Pedido sem código'}</small>
              </span>
              <span className={styles.openRequestPeople}>
                <small>{request.requester_name || request.requester?.nome || 'Solicitante não informado'}</small>
                <small>{request.department_name || request.department?.name || 'Sem setor'}</small>
              </span>
              <span className={styles.openRequestDates}>
                <small>Solicitado em {formatDate(request.created_at)}</small>
                {request.expected_delivery_at && <small>Previsão {formatDate(request.expected_delivery_at)}</small>}
              </span>
              <span className={`${styles.statusBadge} ${styles[`status_${request.status}`] || ''}`}>
                {STATUS_LABELS[request.status] || request.status}
              </span>
              {request.priority === 'urgente' && <span className={styles.urgentBadge}>Urgente</span>}
              <ChevronRight size={17} />
            </button>
          ))}
          {Number(total || 0) > requests.length && (
            <span className={styles.openRequestsHint}>
              Exibindo {requests.length} de {formatQuantity(total)} pedido(s) em aberto.
            </span>
          )}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum pedido em aberto"
          text="Novas solicitações aparecerão aqui."
        />
      )}
    </DashboardCard>
  );
}

function DailyReceiptsCard({ receipts, onOpenReceipt, onViewAll }) {
  return (
    <DashboardCard title="Recebimentos do dia" icon={Truck} actionLabel="Ver todos" onAction={onViewAll}>
      {receipts.length ? (
        <div className={styles.receiptList}>
          {receipts.slice(0, 3).map((receipt) => (
            <button
              type="button"
              key={receipt.id}
              className={styles.receiptItem}
              onClick={() => onOpenReceipt(receipt)}
            >
              <span className={styles.receiptIcon}><Truck size={18} /></span>
              <span className={styles.receiptInfo}>
                <strong>{getItemDisplayName({ item_name: receipt.item_description, description: receipt.description })}</strong>
                <small>{receipt.order_number || receipt.code ? `Pedido ${receipt.order_number || receipt.code}` : 'Pedido sem código'}</small>
                <small>{receipt.supplier_name || 'Fornecedor não informado'}</small>
                <small>{formatDateTime(receipt.expected_delivery_at) || formatDate(receipt.expected_delivery_at)}</small>
              </span>
              <span className={styles.receiptNumbers}>
                <strong>{receipt.items_count || 0} item(ns)</strong>
                <small>{formatMoney(receipt.total_value)}</small>
              </span>
              <span className={`${styles.statusBadge} ${styles[`receipt_${receipt.status}`] || ''}`}>
                {RECEIPT_STATUS_LABELS[receipt.status] || receipt.status || 'Agendado'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Truck}
          title="Nenhum recebimento previsto para hoje"
          text="Pedidos com previsão para a data atual aparecerão aqui."
        />
      )}
    </DashboardCard>
  );
}

function OpenPurchasesCard({ groups, totalOrders, totalValue, onViewAll, onSelectGroup }) {
  const normalizedGroups = OPEN_PURCHASE_GROUPS.map((config) => {
    const found = groups.find((group) => group.key === config.key);
    return { ...config, ...(found || {}), total_orders: Number(found?.total_orders || 0) };
  });
  const gradient = buildDonutGradient(normalizedGroups, totalOrders);

  return (
    <DashboardCard title="Compras em aberto" icon={BarChart3} actionLabel="Ver todos os pedidos" onAction={onViewAll}>
      <div className={styles.openPurchasesLayout}>
        <div className={styles.donut} style={{ background: gradient }}>
          <span>
            <strong>{totalOrders}</strong>
            <small>pedidos</small>
          </span>
        </div>
        <div className={styles.openSummary}>
          <span>Valor total em aberto</span>
          <strong>{formatMoney(totalValue)}</strong>
          <div className={styles.chartLegend}>
            {normalizedGroups.map((group) => {
              const percent = totalOrders ? Math.round((Number(group.total_orders || 0) / totalOrders) * 100) : 0;
              return (
                <button type="button" key={group.key} onClick={() => onSelectGroup(group)}>
                  <i style={{ background: group.color }} />
                  <span>{group.label}</span>
                  <strong>{formatQuantity(group.total_orders)} · {percent}%</strong>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}

function QuotationComparisonCard({ quotes, onOpenQuote, onViewAll }) {
  const selectedQuote = quotes.find((quote) => quote.status === 'selecionada');
  const bestByPrice = quotes.reduce((best, quote) => {
    if (quote.total_price === null || quote.total_price === undefined) return best;
    if (!best || Number(quote.total_price) < Number(best.total_price)) return quote;
    return best;
  }, null);
  const bestQuoteId = selectedQuote?.id || bestByPrice?.id;

  return (
    <DashboardCard title="Cotação comparativa" icon={Receipt} actionLabel="Ver todas" onAction={onViewAll}>
      {quotes.length ? (
        <div className={styles.tableScroll}>
          <table className={styles.quoteTable}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Fornecedor</th>
                <th>Prazo</th>
                <th>Preço unitário</th>
                <th>Valor total</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const isBest = quote.id === bestQuoteId;
                return (
                  <tr
                    key={quote.id}
                    className={isBest ? styles.bestQuote : ''}
                    onClick={() => onOpenQuote(quote)}
                  >
                    <td>
                      <span className={styles.quoteSupplier}>
                        <strong>{getItemDisplayName({ item_name: quote.item_name, description: quote.item_description })}</strong>
                        {quote.code && <small>Pedido {quote.code}</small>}
                      </span>
                    </td>
                    <td>
                      <span className={styles.quoteSupplier}>
                        <strong>{quote.supplier_name || 'Fornecedor não informado'}</strong>
                        {isBest && (
                          <small>
                            <CheckCircle2 size={13} />
                            {selectedQuote?.id === quote.id ? 'Fornecedor preferencial' : 'Melhor preço'}
                          </small>
                        )}
                      </span>
                    </td>
                    <td>{quote.delivery_days === null || quote.delivery_days === undefined ? 'Sem prazo' : `${quote.delivery_days} dia(s)`}</td>
                    <td>{formatMoney(quote.unit_price)}</td>
                    <td>{formatMoney(quote.total_price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Receipt}
          title="Nenhuma cotação disponível"
          text="Cotações registradas nas solicitações aparecerão aqui."
        />
      )}
    </DashboardCard>
  );
}

function RequesterSummaryCard({ icon: Icon, title, value, accent, onClick }) {
  return (
    <button type="button" className={`${styles.requesterSummaryCard} ${styles[`accent_${accent}`] || ''}`} onClick={onClick}>
      <span>{createElement(Icon, { size: 21 })}</span>
      <small>{title}</small>
      <strong>{formatQuantity(value)}</strong>
    </button>
  );
}

function NewRequestBanner({ onCreate }) {
  return (
    <section className={styles.requestBanner}>
      <div className={styles.bannerCopy}>
        <h2>Faça sua solicitação</h2>
        <p>Preencha os dados do material que você precisa e nossa equipe fará a análise.</p>
        <button type="button" className={styles.bannerButton} onClick={onCreate}>
          <Plus size={17} />
          Criar nova solicitação
        </button>
      </div>
      <div className={styles.bannerIllustration} aria-hidden="true">
        <span className={styles.bannerBox}><PackageCheck size={44} /></span>
        <span className={styles.bannerChecklist}><ClipboardList size={52} /></span>
        <span className={styles.bannerCheck}><CheckCircle2 size={26} /></span>
      </div>
    </section>
  );
}

function RequesterEmptyState({ onCreate }) {
  return (
    <div className={styles.requestEmptyState}>
      <PackageCheck size={38} />
      <strong>Você ainda não fez nenhuma solicitação.</strong>
      <span>Quando precisar de algum material, crie uma nova solicitação e acompanhe o andamento por aqui.</span>
      <button type="button" className={styles.primaryButton} onClick={onCreate}>
        <Plus size={17} />
        Criar primeira solicitação
      </button>
    </div>
  );
}

function RequesterRecentList({ requests, total, expanded, onExpand, onOpen, onCreate }) {
  return (
    <section className={styles.requesterRecentPanel}>
      <div className={styles.sectionHeader}>
        <div>
          <h2><ClipboardList size={18} /> {expanded ? 'Todas as solicitações' : 'Solicitações recentes'}</h2>
          <p>{total} solicitação(ões) encontrada(s)</p>
        </div>
        {!expanded && requests.length > 0 && (
          <button type="button" className={styles.textButton} onClick={onExpand}>
            Ver todas
            <ArrowRight size={15} />
          </button>
        )}
      </div>

      {requests.length ? (
        <div className={styles.recentRequestList}>
          {requests.map((request) => (
            <button type="button" key={request.id} className={styles.recentRequestRow} onClick={() => onOpen(request.id)}>
              <RequestItemThumbnail request={request} fallbackIcon={FileText} />
              <span className={styles.recentMain}>
                <strong>{getRequestDisplayName(request)}</strong>
                <small>{getRequestQuantityLabel(request)}</small>
                <small>{request.code || 'Rascunho sem código'}</small>
              </span>
              <span className={styles.recentMeta}>
                <small>{formatDate(request.created_at)}</small>
                <small>{request.items_count || 0} item(ns)</small>
              </span>
              <span className={`${styles.statusBadge} ${styles[`status_${request.status}`] || ''}`}>
                {STATUS_LABELS[request.status] || request.status}
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      ) : (
        <RequesterEmptyState onCreate={onCreate} />
      )}
    </section>
  );
}

function RequesterDetailPanel({
  detail,
  detailLoading,
  comment,
  setComment,
  saving,
  submitComment,
  onClose,
}) {
  if (!detailLoading && !detail?.request) return null;

  return (
    <aside className={styles.detailPanel}>
      {detailLoading ? (
        <div className={styles.loadingBox}><Loader2 size={18} /> Abrindo solicitação...</div>
      ) : (
        <>
          <div className={styles.detailHeader}>
            <div>
              <span className={`${styles.statusBadge} ${styles[`status_${detail.request.status}`] || ''}`}>
                {STATUS_LABELS[detail.request.status] || detail.request.status}
              </span>
              <h2>{detail.request.code || 'Rascunho sem código'}</h2>
              <p>{detail.request.department?.name || 'Sem departamento'}</p>
            </div>
            <button type="button" className={styles.iconButton} onClick={onClose} title="Fechar detalhe">
              <X size={18} />
            </button>
          </div>

          <div className={styles.detailMeta}>
            <span>Criada em {formatDateTime(detail.request.created_at)}</span>
            <span>Necessária em {formatDate(detail.request.needed_at)}</span>
            <span>{REQUEST_TYPE_LABELS[detail.request.request_type] || detail.request.request_type}</span>
          </div>

          <section className={styles.detailBlock}>
            <h3>Resumo</h3>
            <p>{detail.request.justification || 'Sem justificativa.'}</p>
            {detail.request.notes && <p>{detail.request.notes}</p>}
          </section>

          <section className={styles.detailBlock}>
            <h3>Itens solicitados</h3>
            <div className={styles.itemList}>
              {detail.items.map((item) => (
                <article key={item.id} className={styles.itemCard}>
                  <div className={styles.itemHeader}>
                    <div>
                      <strong>{item.description}</strong>
                      <span>{item.category_name || 'Sem categoria'} · {formatQuantity(item.requested_quantity, item.unit)}</span>
                    </div>
                    <span className={`${styles.itemStatus} ${styles[`item_${item.item_status}`] || ''}`}>
                      {ITEM_STATUS_LABELS[item.item_status] || item.item_status}
                    </span>
                  </div>
                  {(item.brand || item.model || item.requester_notes || item.purchase_reason) && (
                    <p className={styles.itemNotes}>
                      {[item.brand, item.model, item.purchase_reason, item.requester_notes].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {item.reference_url && (
                    <a href={item.reference_url} target="_blank" rel="noopener noreferrer" className={styles.linkButton}>
                      <ExternalLink size={15} />
                      Abrir referência
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className={styles.detailBlock}>
            <h3>Anexos</h3>
            {detail.attachments.length ? (
              <div className={styles.attachmentList}>
                {detail.attachments.map((attachment) => (
                  <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer">
                    <Paperclip size={14} />
                    {attachment.name}
                    <small>{formatFileSize(attachment.size)}</small>
                  </a>
                ))}
              </div>
            ) : (
              <p>Sem anexos gerais.</p>
            )}
          </section>

          <section className={styles.detailBlock}>
            <h3>Comentários</h3>
            <div className={styles.commentList}>
              {detail.comments.map((item) => (
                <article key={item.id} className={styles.commentCard}>
                  <strong>{item.user?.nome || 'Usuário'}</strong>
                  <p>{item.message}</p>
                  <span>{formatDateTime(item.created_at)}</span>
                </article>
              ))}
            </div>
            <form className={styles.commentForm} onSubmit={submitComment}>
              <textarea
                rows={3}
                value={comment.message}
                onChange={(event) => setComment((current) => ({ ...current, message: event.target.value }))}
                placeholder="Escrever comentário"
              />
              <div>
                <label className={styles.fileButton}>
                  <FileUp size={15} />
                  {comment.file ? comment.file.name : 'Anexo'}
                  <input type="file" onChange={(event) => setComment((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
                </label>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  <MessageSquareText size={16} />
                  Enviar
                </button>
              </div>
            </form>
          </section>

          <section className={styles.detailBlock}>
            <h3>Histórico</h3>
            <div className={styles.historyList}>
              {detail.history.map((entry) => (
                <span key={entry.id}>
                  {formatDateTime(entry.created_at)} · {entry.user?.nome || 'Sistema'} · {entry.action}
                </span>
              ))}
            </div>
          </section>
        </>
      )}
    </aside>
  );
}

export default function PurchaseRequests({ mode = 'panel' } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isRequesterMode = mode === 'requester';
  const isPanelMode = !isRequesterMode;
  const user = useMemo(() => getLocalUser(), []);
  const token = useMemo(() => localStorage.getItem('token'), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const initialSearchRef = useRef(location.search);
  const skipNextRequestsReloadRef = useRef(false);

  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [permissions, setPermissions] = useState({});
  const [dashboard, setDashboard] = useState(DEFAULT_DASHBOARD);
  const [requesterSummary, setRequesterSummary] = useState({
    total: 0,
    em_analise: 0,
    em_cotacao: 0,
    aguardando_entrega: 0,
    concluidas: 0,
  });
  const [totalRequests, setTotalRequests] = useState(0);
  const [requests, setRequests] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState('lista');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => createEmptyRequestForm(user));
  const [comment, setComment] = useState({ message: '', file: null, is_important: false });
  const [actionModal, setActionModal] = useState(null);
  const [actionForm, setActionForm] = useState(createActionForm);
  const [permanentDeleteModal, setPermanentDeleteModal] = useState(null);
  const [permanentDeleteCode, setPermanentDeleteCode] = useState('');
  const [permanentDeleteError, setPermanentDeleteError] = useState('');
  const [permanentDeleteLoadingId, setPermanentDeleteLoadingId] = useState(null);
  const [draggedRequestId, setDraggedRequestId] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [requestsPanelOpen, setRequestsPanelOpen] = useState(false);
  const [topSearch, setTopSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [searchRetryKey, setSearchRetryKey] = useState(0);
  const [exportingKey, setExportingKey] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const canCreate = hasPermission(permissions, 'purchase_request.create');
  const canAssign = hasPermission(permissions, 'purchase_request.assign');
  const canChangeStatus = hasPermission(permissions, 'purchase_request.change_status');
  const canQuote = hasPermission(permissions, 'purchase_quote.manage');
  const canPurchase = hasPermission(permissions, 'purchase_order.manage');
  const canReceive = hasPermission(permissions, 'purchase_receipt.manage');
  const canViewFinancial = hasPermission(permissions, 'purchase_financial.view');
  const canManagePurchasePermissions = user?.perfil === 'admin' || hasPermission(permissions, 'purchase_permissions.manage');
  const canDeletePermanently = user?.perfil === 'admin' || hasPermission(permissions, 'purchase_settings.manage');
  const canAccessRequesterPage = canCreate
    || hasPermission(permissions, 'purchase_request.view_own')
    || hasPermission(permissions, 'purchase_request.view_department')
    || hasPermission(permissions, 'purchase_request.view_all');
  const canAccessPanel = user?.perfil === 'admin'
    || hasPermission(permissions, 'purchase_panel.view')
    || hasPermission(permissions, 'purchase_request.view_all')
    || hasPermission(permissions, 'purchase_request.view_department')
    || hasPermission(permissions, 'purchase_request.assign')
    || hasPermission(permissions, 'purchase_request.change_status')
    || hasPermission(permissions, 'purchase_quote.manage')
    || hasPermission(permissions, 'purchase_order.manage')
    || hasPermission(permissions, 'purchase_receipt.manage')
    || hasPermission(permissions, 'purchase_report.view')
    || hasPermission(permissions, 'purchase_permissions.manage');

  const loadDashboard = useCallback(async () => {
    if (isRequesterMode) return;
    const { data } = await api.get('/purchase-requests/dashboard', { headers });
    setDashboard(normalizeDashboard(data));
  }, [headers, isRequesterMode]);

  const loadRequesterSummary = useCallback(async () => {
    if (!isRequesterMode) return;
    const { data } = await api.get('/purchase-requests/my/summary', { headers });
    setRequesterSummary({
      total: Number(data?.summary?.total || 0),
      em_analise: Number(data?.summary?.em_analise || 0),
      em_cotacao: Number(data?.summary?.em_cotacao || 0),
      aguardando_entrega: Number(data?.summary?.aguardando_entrega || 0),
      concluidas: Number(data?.summary?.concluidas || 0),
    });
    if (Array.isArray(data?.recent)) {
      setRequests(data.recent);
      setTotalRequests(Number(data?.summary?.total || data.recent.length || 0));
    }
    setPermissions(data?.permissions || {});
  }, [headers, isRequesterMode]);

  const loadRequests = useCallback(async () => {
    const params = buildRequestSearchParams(filters);
    if (isRequesterMode) {
      params.set('limit', requestsPanelOpen ? '80' : '5');
    }
    const endpoint = isRequesterMode ? '/purchase-requests/my' : '/purchase-requests';
    const { data } = await api.get(`${endpoint}?${params.toString()}`, { headers });
    setRequests(Array.isArray(data.requests) ? data.requests : []);
    setTotalRequests(Number(data.total || data.requests?.length || 0));
    setPermissions(data.permissions || {});
  }, [filters, headers, isRequesterMode, requestsPanelOpen]);

  const loadOptions = useCallback(async () => {
    const endpoint = isRequesterMode ? '/purchase-requests/my/options' : '/purchase-requests/options';
    const { data } = await api.get(endpoint, { headers });
    setOptions({ ...DEFAULT_OPTIONS, ...(data || {}) });
    setPermissions(data.permissions || {});
  }, [headers, isRequesterMode]);

  const exportRequestsToExcel = useCallback(async (exportFilters = filters, key = 'filtered') => {
    try {
      setExportingKey(key);
      setExportMenuOpen(false);
      setError('');
      const endpoint = isRequesterMode ? '/purchase-requests/my/export' : '/purchase-requests/export';
      const params = buildRequestSearchParams(exportFilters);
      const response = await api.get(endpoint, {
        headers,
        params,
        responseType: 'blob',
      });
      const disposition = response.headers?.['content-disposition'] || '';
      const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fileName = fileNameMatch?.[1] || `pedidos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setFeedback('Exportação Excel gerada.');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      setError(err.response?.data?.error || 'Não foi possível exportar os pedidos em Excel.');
    } finally {
      setExportingKey('');
    }
  }, [filters, headers, isRequesterMode]);

  const loadInitialData = useCallback(async () => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      setLoading(true);
      setError('');
      const { data: accessData } = await api.get('/purchase-permissions/me', { headers });
      if (!accessData?.can_access) {
        setPermissions(accessData?.permissions || {});
        setError('Seu usuário não tem permissão para acessar o módulo de solicitações.');
        skipNextRequestsReloadRef.current = true;
        return;
      }
      setPermissions(accessData.permissions || {});
      if (isPanelMode && !accessData?.can_panel_access) {
        setError('Você não possui cargo para acessar este recurso.');
        skipNextRequestsReloadRef.current = true;
        return;
      }
      if (isRequesterMode && !accessData?.can_requester_access) {
        setError('Você não possui cargo para acessar este recurso.');
        skipNextRequestsReloadRef.current = true;
        return;
      }

      if (isRequesterMode) {
        await Promise.all([loadOptions(), loadRequesterSummary()]);
        skipNextRequestsReloadRef.current = true;
        return;
      }

      const initialPanelQuery = parsePanelSearch(initialSearchRef.current);
      const initialRequestParams = initialPanelQuery.shouldOpen
        ? buildRequestSearchParams(initialPanelQuery.filters).toString()
        : '';
      const requestsEndpoint = initialRequestParams ? `/purchase-requests?${initialRequestParams}` : '/purchase-requests';
      const requestsResponse = api.get(requestsEndpoint, { headers });
      const [requestsResult] = await Promise.all([requestsResponse, loadOptions(), loadDashboard()]);
      setRequests(Array.isArray(requestsResult.data?.requests) ? requestsResult.data.requests : []);
      setTotalRequests(Number(requestsResult.data?.total || requestsResult.data?.requests?.length || 0));
      setPermissions(requestsResult.data?.permissions || accessData.permissions || {});
      skipNextRequestsReloadRef.current = true;
    } catch (err) {
      console.error('Erro ao carregar compras:', err);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
        return;
      }
      setError(err.response?.status === 403
        ? 'Você não possui cargo para acessar este recurso.'
        : err.response?.data?.error || 'Não foi possível carregar o módulo.');
    } finally {
      setLoading(false);
    }
  }, [headers, isPanelMode, isRequesterMode, loadDashboard, loadOptions, loadRequesterSummary, navigate, token]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!token || loading) return;
    if (skipNextRequestsReloadRef.current) {
      skipNextRequestsReloadRef.current = false;
      return;
    }
    loadRequests().catch((err) => {
      console.error('Erro ao atualizar lista de compras:', err);
      setError(err.response?.data?.error || 'Não foi possível atualizar a lista.');
    });
  }, [filters, loadRequests, loading, requestsPanelOpen, token]);

  useEffect(() => {
    const handleNotification = () => {
      if (isRequesterMode) {
        loadRequesterSummary().catch(() => {});
      } else {
        loadDashboard().catch(() => {});
      }
      loadRequests().catch(() => {});
    };
    socket.on('purchase_notification', handleNotification);
    return () => socket.off('purchase_notification', handleNotification);
  }, [isRequesterMode, loadDashboard, loadRequesterSummary, loadRequests]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        setRequestsPanelOpen(true);
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!isPanelMode || !token) return undefined;
    const q = topSearch.trim();
    setActiveSearchIndex(-1);

    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError('');
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError('');
        const { data } = await api.get('/purchase-requests/search', {
          headers,
          params: { q, limit: 6 },
          signal: controller.signal,
        });
        setSearchResults(Array.isArray(data?.results) ? data.results : []);
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setSearchResults([]);
        setSearchError(err.response?.data?.error || 'Erro ao buscar no painel.');
      } finally {
        setSearchLoading(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [headers, isPanelMode, searchRetryKey, token, topSearch]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!searchContainerRef.current?.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyDetail = useCallback((data) => {
    setDetail(data || null);
    if (data?.request?.id) {
      setSelectedId(data.request.id);
      setRequests((current) => current.map((request) => (
        request.id === data.request.id ? { ...request, ...data.request } : request
      )));
    }
  }, []);

  const refreshAfterMutation = async (requestId = selectedId) => {
    await Promise.all([
      isRequesterMode ? loadRequesterSummary() : loadDashboard(),
      loadRequests(),
    ]);
    if (requestId) {
      const endpoint = isRequesterMode ? `/purchase-requests/my/${requestId}` : `/purchase-requests/${requestId}`;
      const { data } = await api.get(endpoint, { headers });
      applyDetail(data);
    }
  };

  const openDetail = useCallback(async (requestId) => {
    try {
      setSelectedId(requestId);
      setDetailLoading(true);
      setError('');
      const endpoint = isRequesterMode ? `/purchase-requests/my/${requestId}` : `/purchase-requests/${requestId}`;
      const { data } = await api.get(endpoint, { headers });
      applyDetail(data);
    } catch (err) {
      console.error('Erro ao abrir solicitação:', err);
      setError(err.response?.data?.error || 'Não foi possível abrir a solicitação.');
    } finally {
      setDetailLoading(false);
    }
  }, [applyDetail, headers, isRequesterMode]);

  useEffect(() => {
    if (!isPanelMode) return;

    const parsed = parsePanelSearch(location.search);
    if (!parsed.shouldOpen) return;

    setFilters(parsed.filters);
    setRequestsPanelOpen(true);

    if (parsed.requestId) {
      openDetail(parsed.requestId);
    }
  }, [isPanelMode, location.search, openDetail]);

  const updateFilter = (field, value) => {
    setRequestsPanelOpen(true);
    setFilters((current) => ({ ...current, ...DASHBOARD_FILTER_RESET, [field]: value }));
  };

  const logout = () => {
    socket?.disconnect?.();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const openForm = () => {
    setForm(createEmptyRequestForm(user));
    setError('');
    setFormOpen(true);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateDepartmentText = (value) => {
    const normalizedValue = value.trim().toLocaleLowerCase('pt-BR');
    const matchedDepartment = options.departments.find((department) => (
      String(department.name || '').trim().toLocaleLowerCase('pt-BR') === normalizedValue
    ));

    setForm((current) => ({
      ...current,
      department_name: value,
      department_id: matchedDepartment ? String(matchedDepartment.id) : '',
    }));
  };

  const updateItem = (index, field, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )),
    }));
  };

  const addItem = () => {
    setForm((current) => ({ ...current, items: [...current.items, createEmptyItem()] }));
  };

  const removeItem = (index) => {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1
        ? current.items
        : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const submitRequest = async (action) => {
    try {
      setSaving(true);
      setError('');

      if (action === 'submit') {
        const invalidItem = form.items.some((item) => !item.description.trim() || Number(item.requested_quantity || 0) <= 0);
        if (!form.needed_at || invalidItem) {
          setError('Para enviar, informe data necessária e todos os itens com descrição e quantidade.');
          return;
        }
      }

      const payload = new FormData();
      payload.append('action', action);
      payload.append('request_type', form.request_type);
      payload.append('needed_at', form.needed_at);
      payload.append('justification', form.justification);
      payload.append('notes', form.notes);
      payload.append('department_id', form.department_id);
      payload.append('department_name', form.department_name);
      payload.append('cost_center', form.cost_center);
      payload.append('company_unit', form.company_unit);
      payload.append('is_monthly', form.request_type === 'mensal' ? '1' : '0');
      payload.append('items', JSON.stringify(form.items.map((item) => {
        const payloadItem = { ...item };
        delete payloadItem.file;
        return payloadItem;
      })));
      form.attachments.forEach((file) => payload.append('attachments', file));
      form.items.forEach((item, index) => {
        if (item.file) payload.append(`item_attachment_${index}`, item.file);
      });

      const { data } = await api.post('/purchase-requests', payload, { headers });
      applyDetail(data);
      setFormOpen(false);
      setFeedback(isRequesterMode && action === 'submit'
        ? 'Solicitação enviada com sucesso.'
        : action === 'submit' ? 'Solicitação enviada ao almoxarifado.' : 'Rascunho salvo.');
      await refreshAfterMutation(data?.request?.id);
    } catch (err) {
      console.error('Erro ao salvar solicitação:', err);
      setError(err.response?.data?.error || 'Não foi possível salvar a solicitação.');
    } finally {
      setSaving(false);
    }
  };

  const assignRequest = async (assignedUserId) => {
    if (!detail?.request) return;
    try {
      setSaving(true);
      const { data } = await api.post(
        `/purchase-requests/${detail.request.id}/assign`,
        { assigned_user_id: assignedUserId },
        { headers }
      );
      applyDetail(data);
      setFeedback('Responsável atualizado.');
      await refreshAfterMutation(detail.request.id);
    } catch (err) {
      console.error('Erro ao atribuir responsável:', err);
      setError(err.response?.data?.error || 'Não foi possível atribuir responsável.');
    } finally {
      setSaving(false);
    }
  };

  const changeRequestStatus = async (request, status) => {
    if (!request || request.status === status) return;
    const needsReason = ['rejeitada', 'cancelada'].includes(status);
    const justification = needsReason
      ? window.prompt('Informe a justificativa:')
      : '';
    if (needsReason && !justification) return;

    try {
      setSaving(true);
      const { data } = await api.post(
        `/purchase-requests/${request.id}/status`,
        { status, justification },
        { headers }
      );
      applyDetail(data);
      setFeedback('Status atualizado.');
      await refreshAfterMutation(request.id);
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      setError(err.response?.data?.error || 'Não foi possível alterar o status.');
    } finally {
      setSaving(false);
    }
  };

  const submitDraft = async (request) => {
    try {
      setSaving(true);
      const { data } = await api.post(`/purchase-requests/${request.id}/submit`, {}, { headers });
      applyDetail(data);
      setFeedback('Rascunho enviado ao almoxarifado.');
      await refreshAfterMutation(request.id);
    } catch (err) {
      console.error('Erro ao enviar rascunho:', err);
      setError(err.response?.data?.error || 'Não foi possível enviar o rascunho.');
    } finally {
      setSaving(false);
    }
  };

  const cancelRequest = async (request) => {
    const reason = window.prompt('Informe o motivo do cancelamento:');
    if (!reason) return;
    try {
      setSaving(true);
      const { data } = await api.post(`/purchase-requests/${request.id}/cancel`, { reason }, { headers });
      applyDetail(data);
      setFeedback('Solicitação cancelada.');
      await refreshAfterMutation(request.id);
    } catch (err) {
      console.error('Erro ao cancelar solicitação:', err);
      setError(err.response?.data?.error || 'Não foi possível cancelar a solicitação.');
    } finally {
      setSaving(false);
    }
  };

  const changeItemStatus = async (item, status) => {
    if (!item || item.item_status === status) return;
    const justification = status === 'rejeitado'
      ? window.prompt('Informe a justificativa para rejeitar o item:')
      : '';
    if (status === 'rejeitado' && !justification) return;
    try {
      setSaving(true);
      const { data } = await api.post(
        `/purchase-request-items/${item.id}/status`,
        { status, justification },
        { headers }
      );
      applyDetail(data);
      setFeedback('Status do item atualizado.');
      await refreshAfterMutation(data?.request?.id || detail?.request?.id);
    } catch (err) {
      console.error('Erro ao alterar item:', err);
      setError(err.response?.data?.error || 'Não foi possível alterar o item.');
    } finally {
      setSaving(false);
    }
  };

  const getPermanentDeleteCode = (request = {}) => request?.code || (request?.id ? `#${request.id}` : '');
  const normalizeConfirmationCode = (value = '') => String(value || '').trim().toUpperCase();

  const openPermanentDeleteModal = (request) => {
    if (!request || request.status !== 'cancelada' || !canDeletePermanently) return;
    setPermanentDeleteModal(request);
    setPermanentDeleteCode('');
    setPermanentDeleteError('');
    setError('');
  };

  const closePermanentDeleteModal = () => {
    if (permanentDeleteLoadingId) return;
    setPermanentDeleteModal(null);
    setPermanentDeleteCode('');
    setPermanentDeleteError('');
  };

  const deleteRequestPermanently = async () => {
    if (!permanentDeleteModal) return;
    const expectedCode = getPermanentDeleteCode(permanentDeleteModal);
    if (normalizeConfirmationCode(permanentDeleteCode) !== normalizeConfirmationCode(expectedCode)) {
      setPermanentDeleteError(`Digite ${expectedCode} para confirmar a exclusão.`);
      return;
    }

    try {
      setPermanentDeleteLoadingId(permanentDeleteModal.id);
      setError('');
      await api.post(
        `/purchase-requests/${permanentDeleteModal.id}/permanent-delete`,
        { confirmation_code: permanentDeleteCode.trim() },
        { headers }
      );
      setRequests((current) => current.filter((request) => request.id !== permanentDeleteModal.id));
      setTotalRequests((current) => Math.max(0, Number(current || 0) - 1));
      if (selectedId === permanentDeleteModal.id) {
        setDetail(null);
        setSelectedId(null);
      }
      setPermanentDeleteModal(null);
      setPermanentDeleteCode('');
      setPermanentDeleteError('');
      setFeedback('Pedido excluído permanentemente.');

      Promise.all([loadDashboard(), loadRequests()]).catch((refreshErr) => {
        console.error('Erro ao recarregar após exclusão permanente:', refreshErr);
        setError('Pedido excluído, mas não foi possível atualizar a lista automaticamente. Recarregue a página.');
      });
    } catch (err) {
      console.error('Erro ao excluir permanentemente:', err);
      setPermanentDeleteError(getApiErrorMessage(err, 'Não foi possível excluir o pedido permanentemente.'));
    } finally {
      setPermanentDeleteLoadingId(null);
    }
  };

  const openActionModal = (type, item) => {
    setActionModal({ type, item });
    setActionForm(createActionForm(type, item));
  };

  const submitAction = async () => {
    if (!actionModal?.item || !detail?.request) return;
    const { type, item } = actionModal;

    try {
      setSaving(true);
      setError('');
      let data;

      if (type === 'quote') {
        const payload = new FormData();
        Object.entries(actionForm).forEach(([key, value]) => {
          if (key !== 'files') payload.append(key, value ?? '');
        });
        actionForm.files.forEach((file) => payload.append('proposal', file));
        ({ data } = await api.post(`/purchase-request-items/${item.id}/quotes`, payload, { headers }));
      }

      if (type === 'purchase') {
        const payload = new FormData();
        payload.append('supplier_name', actionForm.supplier_name);
        payload.append('quote_id', actionForm.quote_id);
        payload.append('order_number', actionForm.order_number);
        payload.append('purchase_date', actionForm.purchase_date);
        payload.append('expected_delivery_at', actionForm.expected_delivery_at);
        payload.append('payment_method', actionForm.payment_method);
        payload.append('shipping_price', actionForm.shipping_price);
        payload.append('discount', actionForm.discount);
        payload.append('notes', actionForm.notes);
        payload.append('items', JSON.stringify([{
          request_item_id: item.id,
          quantity: actionForm.quantity,
          unit_price: actionForm.unit_price,
          shipping_price: actionForm.shipping_price,
          discount: actionForm.discount,
        }]));
        actionForm.files.forEach((file) => payload.append('receipt', file));
        ({ data } = await api.post(`/purchase-requests/${detail.request.id}/purchases`, payload, { headers }));
      }

      if (type === 'receive') {
        const payload = new FormData();
        Object.entries(actionForm).forEach(([key, value]) => {
          if (key !== 'files') payload.append(key, value ?? '');
        });
        actionForm.files.forEach((file) => payload.append('receipt', file));
        ({ data } = await api.post(`/purchase-request-items/${item.id}/receive`, payload, { headers }));
      }

      applyDetail(data);
      setActionModal(null);
      setFeedback(type === 'quote' ? 'Cotação registrada.' : type === 'purchase' ? 'Compra registrada.' : 'Recebimento registrado.');
      await refreshAfterMutation(data?.request?.id || detail.request.id);
    } catch (err) {
      console.error('Erro na ação do item:', err);
      setError(err.response?.data?.error || 'Não foi possível concluir a ação.');
    } finally {
      setSaving(false);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    if (!detail?.request || (!comment.message.trim() && !comment.file)) return;

    try {
      setSaving(true);
      const payload = new FormData();
      payload.append('message', comment.message);
      payload.append('is_important', comment.is_important ? '1' : '0');
      if (comment.file) payload.append('comment_file', comment.file);
      const { data } = await api.post(`/purchase-requests/${detail.request.id}/comments`, payload, { headers });
      applyDetail(data);
      setComment({ message: '', file: null, is_important: false });
      await refreshAfterMutation(detail.request.id);
    } catch (err) {
      console.error('Erro ao comentar:', err);
      setError(err.response?.data?.error || 'Não foi possível enviar o comentário.');
    } finally {
      setSaving(false);
    }
  };

  const dashboardView = useMemo(() => {
    const fallbackGroups = buildOpenGroupsFromRequests(requests, canViewFinancial);
    const fallbackOpenOrders = requests.filter((request) => isOpenRequestStatus(request.status));
    const fallbackOpenValue = canViewFinancial
      ? fallbackOpenOrders.reduce((total, request) => total + getRequestValue(request), 0)
      : null;
    const apiOpenRequests = dashboard.open_requests?.items || [];
    const openGroups = dashboard.open_purchases?.groups?.length
      ? dashboard.open_purchases.groups
      : fallbackGroups;
    const openOrdersTotal = Number(dashboard.open_requests?.total || dashboard.open_purchases?.total_orders || 0) || fallbackOpenOrders.length;
    const openValue = dashboard.open_purchases?.total_value !== null && dashboard.open_purchases?.total_value !== undefined
      ? dashboard.open_purchases.total_value
      : fallbackOpenValue;
    const dailyReceipts = dashboard.daily_receipts?.items || [];
    const topItems = dashboard.top_requested_items || [];
    const leadAverage = dashboard.lead_time?.average_days;
    const leadPrevious = dashboard.lead_time?.previous_average_days;
    const leadComparison = leadAverage !== null && leadAverage !== undefined && leadPrevious !== null && leadPrevious !== undefined
      ? `${leadAverage <= leadPrevious ? 'Melhor' : 'Acima'} que o período anterior`
      : 'Sem histórico anterior';

    return {
      openRequests: apiOpenRequests.length ? apiOpenRequests : fallbackOpenOrders.slice(0, 5),
      criticalItems: dashboard.critical_items || [],
      criticalDataGap: Boolean(dashboard.data_gaps?.critical_items_minimum_stock),
      openGroups,
      openOrdersTotal,
      openValue,
      dailyReceipts,
      dailyReceiptsTotal: Number(dashboard.daily_receipts?.total_receipts || dailyReceipts.length || 0),
      dailyReceiptsValue: dashboard.daily_receipts?.total_value,
      leadAverage,
      leadComparison,
      topItems,
      quotations: dashboard.quotation_comparison || [],
    };
  }, [canViewFinancial, dashboard, requests]);

  const kpis = useMemo(() => {
    const topItem = dashboardView.topItems[0];
    return [
      {
        key: 'critical',
        icon: PackageSearch,
        title: 'Estoque crítico',
        value: dashboardView.criticalDataGap ? '--' : formatQuantity(dashboardView.criticalItems.length),
        subtitle: dashboardView.criticalDataGap ? 'Estoque mínimo indisponível' : 'itens abaixo do mínimo',
        accent: 'red',
        onClick: () => {
          setFilters({ ...DEFAULT_FILTERS, open: true });
          setRequestsPanelOpen(true);
          if (dashboardView.criticalDataGap) {
            setFeedback('Estoque crítico depende do cadastro de estoque mínimo nos itens.');
          }
        },
      },
      {
        key: 'open',
        icon: ClipboardList,
        title: 'Pedidos em aberto',
        value: formatQuantity(dashboardView.openOrdersTotal),
        subtitle: canViewFinancial ? formatCompactMoney(dashboardView.openValue) : 'Valor restrito',
        accent: 'cyan',
        onClick: () => {
          setFilters({ ...DEFAULT_FILTERS, open: true });
          setRequestsPanelOpen(true);
        },
      },
      {
        key: 'receipts',
        icon: Truck,
        title: 'Recebimentos hoje',
        value: formatQuantity(dashboardView.dailyReceiptsTotal),
        subtitle: canViewFinancial ? formatCompactMoney(dashboardView.dailyReceiptsValue) : 'Valor restrito',
        accent: 'purple',
        onClick: () => {
          setFilters({ ...DEFAULT_FILTERS, receipt_date: getTodayInputValue() });
          setRequestsPanelOpen(true);
        },
      },
      {
        key: 'lead-time',
        icon: BarChart3,
        title: 'Lead time médio',
        value: dashboardView.leadAverage === null || dashboardView.leadAverage === undefined ? '--' : `${dashboardView.leadAverage}d`,
        subtitle: dashboardView.leadComparison,
        accent: 'green',
        onClick: () => {
          setFilters({ ...DEFAULT_FILTERS, status: 'concluida' });
          setRequestsPanelOpen(true);
        },
      },
      {
        key: 'ranking',
        icon: Boxes,
        title: 'Itens mais solicitados',
        value: topItem ? formatQuantity(topItem.requests_count) : '--',
        subtitle: topItem ? getItemDisplayName(topItem) : 'Ranking indisponível',
        accent: 'blue',
        footer: 'Ver ranking',
        onClick: () => {
          setFilters({ ...DEFAULT_FILTERS, q: topItem ? getItemDisplayName(topItem) : '' });
          setRequestsPanelOpen(true);
        },
      },
    ];
  }, [canViewFinancial, dashboardView]);

  const requesterKpis = useMemo(() => ([
    {
      key: 'total',
      icon: FileText,
      title: 'Total de solicitações',
      value: requesterSummary.total,
      accent: 'blue',
      filter: { status: '' },
    },
    {
      key: 'analysis',
      icon: Search,
      title: 'Em análise',
      value: requesterSummary.em_analise,
      accent: 'yellow',
      filter: { status: 'em_analise' },
    },
    {
      key: 'quote',
      icon: Receipt,
      title: 'Em cotação',
      value: requesterSummary.em_cotacao,
      accent: 'purple',
      filter: { status: 'em_cotacao' },
    },
    {
      key: 'delivery',
      icon: Truck,
      title: 'Aguardando entrega',
      value: requesterSummary.aguardando_entrega,
      accent: 'cyan',
      filter: { status: 'compra_realizada' },
    },
    {
      key: 'done',
      icon: CheckCircle2,
      title: 'Concluídas',
      value: requesterSummary.concluidas,
      accent: 'green',
      filter: { status: 'concluida' },
    },
  ]), [requesterSummary]);

  const openRequestsPanel = (filterPatch = {}, { requestId = null } = {}) => {
    const nextFilters = { ...DEFAULT_FILTERS, ...filterPatch };
    setFilters(nextFilters);
    setRequestsPanelOpen(true);

    if (isPanelMode) {
      const search = buildPanelSearch(nextFilters, requestId);
      const target = `${PURCHASE_PANEL_ROUTE}?${search}`;
      const current = `${location.pathname}${location.search}`;
      if (current !== target) {
        navigate(target);
      }
    }
  };

  const closeTopSearch = () => {
    setSearchOpen(false);
    setActiveSearchIndex(-1);
  };

  const handleSearchResult = (result) => {
    if (!result) return;
    const title = result.title || '';
    closeTopSearch();

    if (result.type === 'request' && (result.request_id || result.id)) {
      openRequestsPanel({ q: result.meta?.code || title });
      openDetail(result.request_id || result.id);
      return;
    }

    if (result.type === 'supplier' && result.id) {
      openRequestsPanel({ supplier_id: result.id });
      return;
    }

    openRequestsPanel({ q: title });
  };

  const submitTopSearch = () => {
    const q = topSearch.trim();
    if (!q) return;
    closeTopSearch();
    openRequestsPanel({ q });
  };

  const handleTopSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      closeTopSearch();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSearchIndex((current) => (
        searchResults.length ? (current + 1) % searchResults.length : -1
      ));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSearchIndex((current) => {
        if (!searchResults.length) return -1;
        return current <= 0 ? searchResults.length - 1 : current - 1;
      });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (searchOpen && activeSearchIndex >= 0 && searchResults[activeSearchIndex]) {
        handleSearchResult(searchResults[activeSearchIndex]);
        return;
      }
      submitTopSearch();
    }
  };

  const openDashboardItem = (item, filterPatch = {}) => {
    const requestId = item?.request_id || item?.request?.id || item?.id;
    if (requestId) {
      openRequestsPanel(filterPatch, { requestId });
      openDetail(requestId);
      return;
    }
    openRequestsPanel(filterPatch);
  };

  const selectOpenGroup = (group) => {
    const config = getGroupConfig(group.key);
    openRequestsPanel({ status: config.statuses.length === 1 ? config.statuses[0] : '' });
  };

  const exportDashboardRequests = (scope) => {
    if (scope === 'open') {
      exportRequestsToExcel({ ...DEFAULT_FILTERS, open: true }, 'open');
      return;
    }
    if (scope === 'cancelled') {
      exportRequestsToExcel({ ...DEFAULT_FILTERS, status: 'cancelada' }, 'cancelled');
      return;
    }
    if (scope === 'all') {
      exportRequestsToExcel({ ...DEFAULT_FILTERS }, 'all');
      return;
    }
    exportRequestsToExcel(filters, 'filtered');
  };

  const requestsByStatus = useMemo(() => {
    const grouped = Object.fromEntries(KANBAN_COLUMNS.map((status) => [status, []]));
    requests.forEach((request) => {
      const key = grouped[request.status] ? request.status : 'aguardando_almoxarifado';
      grouped[key].push(request);
    });
    return grouped;
  }, [requests]);

  const renderRequestCard = (request, compact = false) => (
    <article
      key={request.id}
      className={`${styles.requestCard} ${selectedId === request.id ? styles.requestCardActive : ''} ${request.priority === 'urgente' ? styles.urgentCard : ''}`}
      onClick={() => openDetail(request.id)}
      draggable={canChangeStatus}
      onDragStart={() => setDraggedRequestId(request.id)}
    >
      <div className={styles.cardTop}>
        <span className={`${styles.statusBadge} ${styles[`status_${request.status}`] || ''}`}>
          {STATUS_LABELS[request.status] || request.status}
        </span>
        {request.priority === 'urgente' && <span className={styles.urgentBadge}>Urgente</span>}
      </div>
      <div className={styles.requestCardSummary}>
        <RequestItemThumbnail request={request} fallbackIcon={PackageSearch} />
        <span className={styles.requestCardSummaryMain}>
          <strong>{getRequestDisplayName(request)}</strong>
          <small>{getRequestQuantityLabel(request)}</small>
          <small>{request.code || 'Rascunho sem código'}</small>
        </span>
      </div>
      {!compact && <p>{request.justification || request.notes || 'Sem justificativa registrada.'}</p>}
      <div className={styles.cardMeta}>
        <span>{request.requester?.nome || 'Solicitante'}</span>
        <span>{request.department?.name || request.requester?.department_name || 'Sem departamento'}</span>
        <span>{request.items_count || 0} item(ns)</span>
        <span>Necessário em {formatDate(request.needed_at)}</span>
      </div>
      <div className={styles.cardFooter}>
        <span>{request.assigned_user?.nome || 'Sem responsável'}</span>
        {canViewFinancial && <strong>{formatMoney(request.actual_total || request.estimated_total)}</strong>}
        {request.comments_count > 0 && <span>{request.comments_count} comentário(s)</span>}
        {request.attachments_count > 0 && <Paperclip size={15} />}
      </div>
      {request.status === 'cancelada' && canDeletePermanently && (
        <div className={styles.cardDangerActions}>
          <button
            type="button"
            className={styles.destructiveGhostButton}
            title="Excluir permanentemente"
            aria-label={`Excluir permanentemente ${request.code || `pedido ${request.id}`}`}
            onClick={(event) => {
              event.stopPropagation();
              openPermanentDeleteModal(request);
            }}
            onMouseDown={(event) => event.stopPropagation()}
            disabled={permanentDeleteLoadingId === request.id}
          >
            {permanentDeleteLoadingId === request.id ? <Loader2 size={15} /> : <Trash2 size={15} />}
            Excluir permanentemente
          </button>
        </div>
      )}
    </article>
  );

  const renderReferenceUrlField = (item, index) => (
    <div className={styles.formWide}>
      <label>
        Link do produto ou anúncio
        <input
          value={item.reference_url}
          onChange={(event) => updateItem(index, 'reference_url', event.target.value)}
          placeholder="Cole o link de referência do produto"
        />
      </label>
    </div>
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (isRequesterMode) {
    return (
      <main className={`${styles.page} ${styles.requesterPage}`}>
        <div className={styles.requesterShell}>
          <header className={styles.requesterHeader}>
            <div className={styles.headerTitleGroup}>
              <span className={styles.headerIcon}>
                <ClipboardList size={26} />
              </span>
              <div>
                <h1>Solicitação de Materiais</h1>
                <p>Solicite materiais e acompanhe o andamento dos seus pedidos.</p>
              </div>
            </div>

            <div className={styles.requesterHeaderActions}>
              <button type="button" className={styles.headerIconButton} title="Notificações" onClick={() => setRequestsPanelOpen(true)}>
                <Bell size={19} />
                {dashboard.indicators?.atrasadas > 0 && <span>{dashboard.indicators.atrasadas}</span>}
              </button>
              <button
                type="button"
                className={styles.headerIconButton}
                title="Ajuda"
                onClick={() => setFeedback('Informe descrição, quantidade e data necessária para enviar uma solicitação.')}
              >
                <HelpCircle size={19} />
              </button>
              <div className={`${styles.userCard} ${styles.userCardStatic}`}>
                <span className={styles.userAvatar}>{getInitials(user?.nome)}</span>
                <span>
                  <strong>{user?.nome || 'Usuário'}</strong>
                  <small>{getUserSubtitle(user) || 'Solicitante'}</small>
                </span>
              </div>
              {canAccessPanel && (
                <button type="button" className={styles.secondaryButton} onClick={() => navigate('/solicitacoes-compras')}>
                  <PackageSearch size={17} />
                  Painel Almoxarifado
                </button>
              )}
              {canCreate && (
                <button type="button" className={styles.primaryButton} onClick={openForm}>
                  <Plus size={18} />
                  Nova Solicitação
                </button>
              )}
            </div>
          </header>

          {error && (
            <div className={styles.errorBox}>
              <span>{error}</span>
              <button type="button" className={styles.textButton} onClick={loadInitialData}>Tentar novamente</button>
            </div>
          )}
          {feedback && (
            <div className={styles.successBox} onAnimationEnd={() => setFeedback('')}>
              <CheckCircle2 size={17} />
              {feedback}
            </div>
          )}

          <NewRequestBanner onCreate={openForm} />

          <section className={styles.myRequestsHeader}>
            <div>
              <h2>Minhas solicitações</h2>
              <p>Acompanhe o andamento dos pedidos criados por você.</p>
            </div>
            <div className={styles.sectionActions}>
              {requestsPanelOpen && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => exportRequestsToExcel(filters, 'filtered')}
                  disabled={Boolean(exportingKey)}
                >
                  {exportingKey === 'filtered' ? <Loader2 size={15} /> : <Download size={15} />}
                  Exportar Excel
                </button>
              )}
              {!requestsPanelOpen && requests.length > 0 && (
                <button type="button" className={styles.textButton} onClick={() => setRequestsPanelOpen(true)}>
                  Ver todas
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </section>

          <section className={styles.requesterSummaryGrid}>
            {requesterKpis.map((item) => (
              <RequesterSummaryCard
                key={item.key}
                icon={item.icon}
                title={item.title}
                value={item.value}
                accent={item.accent}
                onClick={() => openRequestsPanel(item.filter)}
              />
            ))}
          </section>

          {requestsPanelOpen && (
            <section className={styles.requesterFilters}>
              <label className={styles.searchBox}>
                <Search size={17} />
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Buscar por código ou descrição do item"
                  value={filters.q}
                  onChange={(event) => updateFilter('q', event.target.value)}
                />
              </label>
              <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                <option value="">Todos os status</option>
                {options.statuses.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
                ))}
              </select>
              <input
                type="date"
                value={filters.start_date}
                onChange={(event) => updateFilter('start_date', event.target.value)}
                aria-label="Data inicial"
              />
              <input
                type="date"
                value={filters.end_date}
                onChange={(event) => updateFilter('end_date', event.target.value)}
                aria-label="Data final"
              />
            </section>
          )}

          <RequesterRecentList
            requests={requests}
            total={totalRequests}
            expanded={requestsPanelOpen}
            onExpand={() => setRequestsPanelOpen(true)}
            onOpen={openDetail}
            onCreate={openForm}
          />

          <RequesterDetailPanel
            detail={detail}
            detailLoading={detailLoading}
            comment={comment}
            setComment={setComment}
            saving={saving}
            submitComment={submitComment}
            onClose={() => setDetail(null)}
          />
        </div>

        {formOpen && (
          <div className={styles.modalOverlay} onClick={() => !saving && setFormOpen(false)}>
            <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Nova solicitação</h2>
                  <p>{user?.nome || 'Solicitante'} · {user?.setor_nome || 'Departamento'}</p>
                </div>
                <button type="button" className={styles.iconButton} onClick={() => setFormOpen(false)} disabled={saving}>
                  <X size={19} />
                </button>
              </div>

              <div className={styles.formGrid}>
                <label>
                  Tipo
                  <select value={form.request_type} onChange={(event) => updateForm('request_type', event.target.value)}>
                    {options.request_types.map((type) => (
                      <option key={type} value={type}>{REQUEST_TYPE_LABELS[type] || type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Data necessária
                  <input type="date" value={form.needed_at} onChange={(event) => updateForm('needed_at', event.target.value)} />
                </label>
                <label>
                  Departamento
                  <input
                    list="purchase-departments"
                    value={form.department_name}
                    onChange={(event) => updateDepartmentText(event.target.value)}
                    placeholder="Digite a área ou departamento"
                  />
                </label>
                <label>
                  Empresa ou unidade
                  <input value={form.company_unit} onChange={(event) => updateForm('company_unit', event.target.value)} />
                </label>
              </div>

              <label className={styles.fullField}>
                Observações gerais
                <textarea rows={3} value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
              </label>
              <label className={styles.fileButton}>
                <FileUp size={16} />
                {form.attachments.length ? `${form.attachments.length} anexo(s)` : `Anexos gerais até ${options.upload_limit_mb} MB`}
                <input type="file" multiple onChange={(event) => updateForm('attachments', Array.from(event.target.files || []))} />
              </label>

              <div className={styles.formItemsHeader}>
                <h3>Itens</h3>
                <button type="button" className={styles.secondaryButton} onClick={addItem}>
                  <Plus size={16} />
                  Adicionar outro item
                </button>
              </div>

              <div className={styles.formItemList}>
                {form.items.map((item, index) => (
                  <article key={`item-${index}`} className={styles.formItemCard}>
                    <div className={styles.formItemTop}>
                      <strong>Item {index + 1}</strong>
                      {form.items.length > 1 && (
                        <button type="button" className={styles.iconButton} onClick={() => removeItem(index)}>
                          <X size={17} />
                        </button>
                      )}
                    </div>
                    <div className={styles.formGrid}>
                      <label className={styles.formWide}>
                        Descrição
                        <input value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} />
                      </label>
                      <label>
                        Categoria
                        <input
                          list="purchase-categories"
                          value={item.category_name}
                          onChange={(event) => updateItem(index, 'category_name', event.target.value)}
                        />
                      </label>
                      <label>
                        Quantidade
                        <input type="number" min="0" step="0.001" value={item.requested_quantity} onChange={(event) => updateItem(index, 'requested_quantity', event.target.value)} />
                      </label>
                      <label>
                        Unidade
                        <select value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)}>
                          {options.units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                      </label>
                      <label>
                        Marca
                        <input value={item.brand} onChange={(event) => updateItem(index, 'brand', event.target.value)} />
                      </label>
                      <label>
                        Modelo
                        <input value={item.model} onChange={(event) => updateItem(index, 'model', event.target.value)} />
                      </label>
                      {renderReferenceUrlField(item, index)}
                      <label className={styles.formWide}>
                        Motivo da compra
                        <textarea rows={2} value={item.purchase_reason} onChange={(event) => updateItem(index, 'purchase_reason', event.target.value)} />
                      </label>
                      <label className={styles.formWide}>
                        Observações
                        <textarea rows={2} value={item.requester_notes} onChange={(event) => updateItem(index, 'requester_notes', event.target.value)} />
                      </label>
                    </div>
                    <label className={styles.fileButton}>
                      <FileUp size={15} />
                      {item.file ? item.file.name : 'Foto ou anexo do item'}
                      <input type="file" onChange={(event) => updateItem(index, 'file', event.target.files?.[0] || null)} />
                    </label>
                  </article>
                ))}
              </div>

              <datalist id="purchase-categories">
                {options.categories.map((category) => <option key={category.id} value={category.name} />)}
              </datalist>
              <datalist id="purchase-departments">
                {options.departments.map((department) => <option key={department.id} value={department.name} />)}
              </datalist>

              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button>
                <button type="button" className={styles.secondaryButton} onClick={() => submitRequest('draft')} disabled={saving}>
                  {saving ? <Loader2 size={16} /> : <FileText size={16} />}
                  Salvar rascunho
                </button>
                <button type="button" className={styles.primaryButton} onClick={() => submitRequest('submit')} disabled={saving}>
                  {saving ? <Loader2 size={16} /> : <Send size={16} />}
                  Enviar solicitação
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topHeader}>
          <div className={styles.headerTitleGroup}>
            <span className={styles.headerIcon}>
              <ShoppingCart size={26} />
            </span>
            <div>
              <h1>Painel Almoxarifado</h1>
              <p>Gerencie solicitações, compras, estoque, cotações e recebimentos.</p>
            </div>
          </div>

          <div className={styles.globalSearchWrap} ref={searchContainerRef}>
            <label className={styles.globalSearch}>
              <Search size={18} />
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Buscar produtos, pedidos, fornecedores..."
                value={topSearch}
                onFocus={() => {
                  if (topSearch.trim().length >= 2) setSearchOpen(true);
                }}
                onChange={(event) => {
                  setTopSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={handleTopSearchKeyDown}
              />
              <kbd>Ctrl + K</kbd>
            </label>
            {searchOpen && topSearch.trim().length >= 2 && (
              <div className={styles.searchPopover} role="listbox" aria-label="Resultados da busca do almoxarifado">
                {searchLoading && (
                  <div className={styles.searchState}>
                    <Loader2 size={16} />
                    Buscando...
                  </div>
                )}
                {!searchLoading && searchError && (
                  <div className={styles.searchState}>
                    <span>{searchError}</span>
                    <button type="button" className={styles.textButton} onClick={() => setSearchRetryKey((current) => current + 1)}>
                      Tentar novamente
                    </button>
                  </div>
                )}
                {!searchLoading && !searchError && searchResults.length === 0 && (
                  <div className={styles.searchState}>Nenhum resultado encontrado</div>
                )}
                {!searchLoading && !searchError && searchResults.map((result, index) => (
                  <button
                    type="button"
                    key={`${result.type}-${result.id}-${index}`}
                    className={`${styles.searchResultItem} ${index === activeSearchIndex ? styles.searchResultActive : ''}`}
                    role="option"
                    aria-selected={index === activeSearchIndex}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => handleSearchResult(result)}
                  >
                    <span>{SEARCH_TYPE_LABELS[result.type] || 'Resultado'}</span>
                    <strong>{result.title || 'Item sem nome'}</strong>
                    {result.subtitle && <small>{result.subtitle}</small>}
                    {result.status && (
                      <small className={styles.searchStatus}>{STATUS_LABELS[result.status] || result.status}</small>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.headerActions}>
            <button type="button" className={styles.headerIconButton} title="Notificações" onClick={() => openRequestsPanel({ overdue: true })}>
              <Bell size={19} />
              {dashboard.indicators?.atrasadas > 0 && <span>{dashboard.indicators.atrasadas}</span>}
            </button>
            <button
              type="button"
              className={styles.headerIconButton}
              title="Ajuda"
              onClick={() => setFeedback('Use a busca ou os cards para abrir solicitações, cotações e recebimentos filtrados.')}
            >
              <HelpCircle size={19} />
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                if (canAccessRequesterPage) {
                  navigate('/solicitacoes');
                  return;
                }
                setError('Você não possui cargo para acessar este recurso.');
              }}
            >
              <ClipboardList size={17} />
              Solicitações
            </button>
            <div className={styles.userMenu}>
              <button type="button" className={styles.userCard} onClick={() => setUserMenuOpen((current) => !current)}>
                <span className={styles.userAvatar}>{getInitials(user?.nome)}</span>
                <span>
                  <strong>{user?.nome || 'Usuário'}</strong>
                  <small>{getUserSubtitle(user)}</small>
                </span>
                <ChevronDown size={16} />
              </button>
              {userMenuOpen && (
                <div className={styles.userMenuPopover}>
                  {canManagePurchasePermissions && (
                    <button type="button" onClick={() => navigate('/admin/permissoes-compras')}>
                      <UserCheck size={15} />
                      Permissões
                    </button>
                  )}
                  <button type="button" onClick={logout}>
                    Sair
                  </button>
                </div>
              )}
            </div>
            {canCreate && (
              <button type="button" className={styles.primaryButton} onClick={openForm}>
                <Plus size={18} />
                Nova Solicitação
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className={styles.errorBox}>
            <span>{error}</span>
            <button type="button" className={styles.textButton} onClick={loadInitialData}>Tentar novamente</button>
          </div>
        )}
        {feedback && (
          <div className={styles.successBox} onAnimationEnd={() => setFeedback('')}>
            <CheckCircle2 size={17} />
            {feedback}
          </div>
        )}

        <section className={styles.kpiGrid}>
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.key}
              icon={kpi.icon}
              title={kpi.title}
              value={kpi.value}
              subtitle={kpi.subtitle}
              accent={kpi.accent}
              footer={kpi.footer}
              onClick={kpi.onClick}
            />
          ))}
        </section>

        <div className={styles.dashboardMainRow}>
          <OpenRequestsCard
            requests={dashboardView.openRequests}
            total={dashboardView.openOrdersTotal}
            onOpenRequest={(request) => openDashboardItem(request, { open: true })}
            onViewAll={() => openRequestsPanel({ open: true })}
            exportActions={(
              <ExportMenu
                open={exportMenuOpen}
                exportingKey={exportingKey}
                onToggle={() => setExportMenuOpen((current) => !current)}
                onExport={exportDashboardRequests}
              />
            )}
          />
          <DailyReceiptsCard
            receipts={dashboardView.dailyReceipts}
            onOpenReceipt={(receipt) => openDashboardItem(receipt, { receipt_date: getTodayInputValue() })}
            onViewAll={() => openRequestsPanel({ receipt_date: getTodayInputValue() })}
          />
        </div>

        <div className={styles.dashboardMainRow}>
          <OpenPurchasesCard
            groups={dashboardView.openGroups}
            totalOrders={dashboardView.openOrdersTotal}
            totalValue={dashboardView.openValue}
            onViewAll={() => openRequestsPanel({ open: true })}
            onSelectGroup={selectOpenGroup}
          />
          <QuotationComparisonCard
            quotes={dashboardView.quotations}
            onOpenQuote={(quote) => openDashboardItem(quote, { has_quotes: true })}
            onViewAll={() => openRequestsPanel({ has_quotes: true })}
          />
        </div>

        <section className={`${styles.requestsPanel} ${requestsPanelOpen ? styles.requestsPanelOpen : ''}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2><ClipboardList size={18} /> Solicitações filtradas</h2>
              <p>{requests.length} de {formatQuantity(totalRequests)} resultado(s) com os filtros atuais</p>
            </div>
            <div className={styles.sectionActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => exportRequestsToExcel(filters, 'filtered')}
                disabled={Boolean(exportingKey)}
              >
                {exportingKey === 'filtered' ? <Loader2 size={15} /> : <Download size={15} />}
                Exportar Excel
              </button>
              <button type="button" className={styles.iconButton} onClick={() => setRequestsPanelOpen(false)} title="Fechar solicitações">
                <X size={18} />
              </button>
            </div>
          </div>

        <section className={styles.toolbar}>
          <label className={styles.searchBox}>
            <Search size={17} />
            <input
              type="search"
              placeholder="Pesquisar por código, solicitante, item ou justificativa"
              value={filters.q}
              onChange={(event) => updateFilter('q', event.target.value)}
            />
          </label>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">Todos os status</option>
            {options.statuses.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
            ))}
          </select>
          <select value={filters.department_id} onChange={(event) => updateFilter('department_id', event.target.value)}>
            <option value="">Todos os departamentos</option>
            {options.departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
          <select value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
            <option value="">Prioridade</option>
            <option value="normal">Normal</option>
            <option value="urgente">Urgente</option>
          </select>
          <select value={filters.requester_id} onChange={(event) => updateFilter('requester_id', event.target.value)}>
            <option value="">Solicitante</option>
            {options.users.map((optionUser) => (
              <option key={optionUser.id} value={optionUser.id}>{optionUser.nome}</option>
            ))}
          </select>
          <select value={filters.assigned_user_id} onChange={(event) => updateFilter('assigned_user_id', event.target.value)}>
            <option value="">Responsável</option>
            {options.users.map((optionUser) => (
              <option key={optionUser.id} value={optionUser.id}>{optionUser.nome}</option>
            ))}
          </select>
          <select value={filters.supplier_id} onChange={(event) => updateFilter('supplier_id', event.target.value)}>
            <option value="">Fornecedor</option>
            {options.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <select value={filters.purchase_status} onChange={(event) => updateFilter('purchase_status', event.target.value)}>
            <option value="">Situação da compra</option>
            {Object.entries(PURCHASE_SITUATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={filters.receipt_status} onChange={(event) => updateFilter('receipt_status', event.target.value)}>
            <option value="">Situação do recebimento</option>
            {Object.entries(RECEIPT_SITUATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            type="date"
            value={filters.start_date}
            onChange={(event) => updateFilter('start_date', event.target.value)}
            aria-label="Período inicial"
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={(event) => updateFilter('end_date', event.target.value)}
            aria-label="Período final"
          />
          <label className={styles.checkFilter}>
            <input type="checkbox" checked={filters.monthly} onChange={(event) => updateFilter('monthly', event.target.checked)} />
            Mensal
          </label>
          <div className={styles.viewToggle}>
            <button type="button" className={viewMode === 'lista' ? styles.activeToggle : ''} onClick={() => setViewMode('lista')}>
              <ClipboardList size={16} />
              Lista
            </button>
            <button type="button" className={viewMode === 'kanban' ? styles.activeToggle : ''} onClick={() => setViewMode('kanban')}>
              <KanbanSquare size={16} />
              Kanban
            </button>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <section className={styles.listPanel}>
            {viewMode === 'lista' ? (
              requests.length ? (
                <div className={styles.requestList}>
                  {requests.map((request) => renderRequestCard(request))}
                </div>
              ) : (
                <div className={styles.emptyState}>Nenhuma solicitação encontrada.</div>
              )
            ) : (
              <div className={styles.kanbanBoard}>
                {KANBAN_COLUMNS.map((status) => (
                  <div
                    key={status}
                    className={styles.kanbanColumn}
                    onDragOver={(event) => {
                      if (canChangeStatus) event.preventDefault();
                    }}
                    onDrop={() => {
                      if (!canChangeStatus || !draggedRequestId) return;
                      const request = requests.find((item) => item.id === draggedRequestId);
                      changeRequestStatus(request, status);
                      setDraggedRequestId(null);
                    }}
                  >
                    <div className={styles.kanbanHeader}>
                      <strong>{STATUS_LABELS[status]}</strong>
                      <span>{requestsByStatus[status]?.length || 0}</span>
                    </div>
                    {(requestsByStatus[status] || []).map((request) => renderRequestCard(request, true))}
                  </div>
                ))}
              </div>
            )}
          </section>

          {(detailLoading || detail?.request) && (
          <aside className={styles.detailPanel}>
            {detailLoading ? (
              <div className={styles.loadingBox}><Loader2 size={18} /> Abrindo solicitação...</div>
            ) : detail?.request ? (
              <>
                <div className={styles.detailHeader}>
                  <div>
                    <span className={`${styles.statusBadge} ${styles[`status_${detail.request.status}`] || ''}`}>
                      {STATUS_LABELS[detail.request.status]}
                    </span>
                    <h2>{detail.request.code || 'Rascunho sem código'}</h2>
                    <p>{detail.request.requester?.nome} · {detail.request.department?.name || 'Sem departamento'}</p>
                  </div>
                  <button type="button" className={styles.iconButton} onClick={() => setDetail(null)} title="Fechar detalhe">
                    <X size={18} />
                  </button>
                </div>

                <div className={styles.detailMeta}>
                  <span>Criada em {formatDateTime(detail.request.created_at)}</span>
                  <span>Necessária em {formatDate(detail.request.needed_at)}</span>
                  <span>{REQUEST_TYPE_LABELS[detail.request.request_type]}</span>
                  <span>{detail.request.is_monthly ? 'Mensal' : 'Pontual'}</span>
                  {canViewFinancial && <span>Estimado {formatMoney(detail.request.estimated_total)}</span>}
                  {canViewFinancial && <span>Comprado {formatMoney(detail.request.actual_total)}</span>}
                </div>

                <section className={styles.detailBlock}>
                  <h3>Atendimento</h3>
                  <div className={styles.assignmentRow}>
                    <label>
                      Responsável
                      <select
                        value={detail.request.assigned_user?.id || ''}
                        onChange={(event) => assignRequest(event.target.value)}
                        disabled={!canAssign || saving}
                      >
                        <option value="">Sem responsável</option>
                        {options.users.map((optionUser) => (
                          <option key={optionUser.id} value={optionUser.id}>{optionUser.nome}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status geral
                      <select
                        value={detail.request.status}
                        onChange={(event) => changeRequestStatus(detail.request, event.target.value)}
                        disabled={!canChangeStatus || saving}
                      >
                        {options.statuses.map((status) => (
                          <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p>{detail.request.justification || 'Sem justificativa.'}</p>
                  {detail.request.notes && <p>{detail.request.notes}</p>}
                  <div className={styles.inlineActions}>
                    {detail.request.status === 'rascunho' && canCreate && (
                      <button type="button" className={styles.primaryButton} onClick={() => submitDraft(detail.request)} disabled={saving}>
                        <Send size={16} />
                        Enviar ao almoxarifado
                      </button>
                    )}
                    {!isFinalRequestStatus(detail.request.status) && (
                      <button type="button" className={styles.secondaryButton} onClick={() => cancelRequest(detail.request)} disabled={saving}>
                        Cancelar
                      </button>
                    )}
                  </div>
                  {detail.request.status === 'cancelada' && canDeletePermanently && (
                    <div className={styles.dangerZone}>
                      <button
                        type="button"
                        className={styles.destructiveButton}
                        title="Excluir permanentemente"
                        onClick={() => openPermanentDeleteModal(detail.request)}
                        disabled={permanentDeleteLoadingId === detail.request.id}
                      >
                        {permanentDeleteLoadingId === detail.request.id ? <Loader2 size={16} /> : <Trash2 size={16} />}
                        Excluir permanentemente
                      </button>
                    </div>
                  )}
                </section>

                <section className={styles.detailBlock}>
                  <h3>Itens</h3>
                  <div className={styles.itemList}>
                    {detail.items.map((item) => (
                      <article key={item.id} className={styles.itemCard}>
                        <div className={styles.itemHeader}>
                          <div>
                            <strong>{item.description}</strong>
                            <span>{item.category_name || 'Sem categoria'} · {item.requested_quantity} {item.unit}</span>
                          </div>
                          <span className={`${styles.itemStatus} ${styles[`item_${item.item_status}`] || ''}`}>
                            {ITEM_STATUS_LABELS[item.item_status] || item.item_status}
                          </span>
                        </div>

                        <div className={styles.itemMetrics}>
                          <span>Estoque: {item.stock_quantity}</span>
                          <span>Aprovado: {item.approved_quantity}</span>
                          <span>Comprado: {item.purchased_quantity}</span>
                          <span>Recebido: {item.received_quantity}</span>
                          <span>Pendente: {item.pending_quantity}</span>
                          {canViewFinancial && <span>Total: {formatMoney(item.total_price || (item.requested_quantity * item.estimated_unit_price))}</span>}
                        </div>

                        {(item.brand || item.model || item.requester_notes || item.purchase_reason) && (
                          <p className={styles.itemNotes}>
                            {[item.brand, item.model, item.purchase_reason, item.requester_notes].filter(Boolean).join(' · ')}
                          </p>
                        )}

                        <div className={styles.itemActions}>
                          {item.reference_url && (
                            <a href={item.reference_url} target="_blank" rel="noopener noreferrer" className={styles.linkButton}>
                              <ExternalLink size={15} />
                              Abrir referência
                            </a>
                          )}
                          {canChangeStatus && (
                            <select value={item.item_status} onChange={(event) => changeItemStatus(item, event.target.value)} disabled={saving}>
                              {options.item_statuses.map((status) => (
                                <option key={status} value={status}>{ITEM_STATUS_LABELS[status] || status}</option>
                              ))}
                            </select>
                          )}
                          {canQuote && (
                            <button type="button" className={styles.smallButton} onClick={() => openActionModal('quote', item)}>
                              <Receipt size={15} />
                              Registrar cotação
                            </button>
                          )}
                          {canPurchase && (
                            <button type="button" className={styles.smallButton} onClick={() => openActionModal('purchase', item)}>
                              <ShoppingCart size={15} />
                              Registrar compra
                            </button>
                          )}
                          {canReceive && (
                            <button type="button" className={styles.smallButton} onClick={() => openActionModal('receive', item)}>
                              <Truck size={15} />
                              Registrar recebimento
                            </button>
                          )}
                        </div>

                        {item.quotes.length > 0 && (
                          <div className={styles.subList}>
                            <strong>Cotações</strong>
                            {item.quotes.slice(0, 3).map((quote) => (
                              <span key={quote.id}>
                                {quote.supplier_name || 'Fornecedor'} · {quote.status.replace(/_/g, ' ')}
                                {canViewFinancial ? ` · ${formatMoney(quote.total_price)}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.receipts.length > 0 && (
                          <div className={styles.subList}>
                            <strong>Recebimentos</strong>
                            {item.receipts.slice(0, 3).map((receipt) => (
                              <span key={receipt.id}>
                                {receipt.quantity_received} {item.unit} · {RECEIPT_CONDITION_LABELS[receipt.condition_status]}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.attachments.length > 0 && (
                          <div className={styles.attachmentList}>
                            {item.attachments.map((attachment) => (
                              <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer">
                                <Paperclip size={14} />
                                {attachment.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>

                <section className={styles.detailBlock}>
                  <h3>Anexos</h3>
                  {detail.attachments.length ? (
                    <div className={styles.attachmentList}>
                      {detail.attachments.map((attachment) => (
                        <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer">
                          <Paperclip size={14} />
                          {attachment.name}
                          <small>{formatFileSize(attachment.size)}</small>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p>Sem anexos gerais.</p>
                  )}
                </section>

                <section className={styles.detailBlock}>
                  <h3>Comentários</h3>
                  <div className={styles.commentList}>
                    {detail.comments.map((item) => (
                      <article key={item.id} className={styles.commentCard}>
                        <strong>{item.user?.nome || 'Usuário'}</strong>
                        <p>{item.message}</p>
                        <span>{formatDateTime(item.created_at)}</span>
                      </article>
                    ))}
                  </div>
                  <form className={styles.commentForm} onSubmit={submitComment}>
                    <textarea
                      rows={3}
                      value={comment.message}
                      onChange={(event) => setComment((current) => ({ ...current, message: event.target.value }))}
                      placeholder="Escrever comentário, usar @nome para mencionar"
                    />
                    <div>
                      <label className={styles.fileButton}>
                        <FileUp size={15} />
                        {comment.file ? comment.file.name : 'Anexo'}
                        <input type="file" onChange={(event) => setComment((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
                      </label>
                      <label className={styles.checkFilter}>
                        <input
                          type="checkbox"
                          checked={comment.is_important}
                          onChange={(event) => setComment((current) => ({ ...current, is_important: event.target.checked }))}
                        />
                        Importante
                      </label>
                      <button type="submit" className={styles.primaryButton} disabled={saving}>
                        <MessageSquareText size={16} />
                        Enviar
                      </button>
                    </div>
                  </form>
                </section>

                <section className={styles.detailBlock}>
                  <h3>Histórico</h3>
                  <div className={styles.historyList}>
                    {detail.history.map((entry) => (
                      <span key={entry.id}>
                        {formatDateTime(entry.created_at)} · {entry.user?.nome || 'Sistema'} · {entry.action}
                      </span>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <div className={styles.emptyDetail}>
                <PackageCheck size={42} />
                <strong>Selecione uma solicitação</strong>
                <span>Os detalhes, itens e comentários aparecem aqui.</span>
              </div>
            )}
          </aside>
          )}
        </div>
        </section>
      </div>

      {formOpen && (
        <div className={styles.modalOverlay} onClick={() => !saving && setFormOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Nova solicitação</h2>
                <p>{user?.nome || 'Solicitante'} · {user?.setor_nome || 'Departamento'}</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setFormOpen(false)} disabled={saving}>
                <X size={19} />
              </button>
            </div>

            <div className={styles.formGrid}>
              <label>
                Tipo
                <select value={form.request_type} onChange={(event) => updateForm('request_type', event.target.value)}>
                  {options.request_types.map((type) => (
                    <option key={type} value={type}>{REQUEST_TYPE_LABELS[type] || type}</option>
                  ))}
                </select>
              </label>
              <label>
                Data necessária
                <input type="date" value={form.needed_at} onChange={(event) => updateForm('needed_at', event.target.value)} />
              </label>
              <label>
                Departamento
                <input
                  list="purchase-departments"
                  value={form.department_name}
                  onChange={(event) => updateDepartmentText(event.target.value)}
                  placeholder="Digite a área ou departamento"
                />
              </label>
              <label>
                Empresa ou unidade
                <input value={form.company_unit} onChange={(event) => updateForm('company_unit', event.target.value)} />
              </label>
            </div>

            <label className={styles.fullField}>
              Observações gerais
              <textarea rows={3} value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
            </label>
            <label className={styles.fileButton}>
              <FileUp size={16} />
              {form.attachments.length ? `${form.attachments.length} anexo(s)` : `Anexos gerais até ${options.upload_limit_mb} MB`}
              <input type="file" multiple onChange={(event) => updateForm('attachments', Array.from(event.target.files || []))} />
            </label>

            <div className={styles.formItemsHeader}>
              <h3>Itens</h3>
              <button type="button" className={styles.secondaryButton} onClick={addItem}>
                <Plus size={16} />
                Adicionar outro item
              </button>
            </div>

            <div className={styles.formItemList}>
              {form.items.map((item, index) => (
                <article key={`item-${index}`} className={styles.formItemCard}>
                  <div className={styles.formItemTop}>
                    <strong>Item {index + 1}</strong>
                    {form.items.length > 1 && (
                      <button type="button" className={styles.iconButton} onClick={() => removeItem(index)}>
                        <X size={17} />
                      </button>
                    )}
                  </div>
                  <div className={styles.formGrid}>
                    <label className={styles.formWide}>
                      Descrição
                      <input value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} />
                    </label>
                    <label>
                      Categoria
                      <input
                        list="purchase-categories"
                        value={item.category_name}
                        onChange={(event) => updateItem(index, 'category_name', event.target.value)}
                      />
                    </label>
                    <label>
                      Estoque
                      <input type="number" min="0" step="0.001" value={item.stock_quantity} onChange={(event) => updateItem(index, 'stock_quantity', event.target.value)} />
                    </label>
                    <label>
                      Quantidade
                      <input type="number" min="0" step="0.001" value={item.requested_quantity} onChange={(event) => updateItem(index, 'requested_quantity', event.target.value)} />
                    </label>
                    <label>
                      Unidade
                      <select value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)}>
                        {options.units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </label>
                    <label>
                      Valor estimado
                      <input type="number" min="0" step="0.01" value={item.estimated_unit_price} onChange={(event) => updateItem(index, 'estimated_unit_price', event.target.value)} />
                    </label>
                    <label>
                      Marca
                      <input value={item.brand} onChange={(event) => updateItem(index, 'brand', event.target.value)} />
                    </label>
                    <label>
                      Modelo
                      <input value={item.model} onChange={(event) => updateItem(index, 'model', event.target.value)} />
                    </label>
                    {renderReferenceUrlField(item, index)}
                    <label className={styles.formWide}>
                      Motivo da compra
                      <textarea rows={2} value={item.purchase_reason} onChange={(event) => updateItem(index, 'purchase_reason', event.target.value)} />
                    </label>
                    <label className={styles.formWide}>
                      Observações
                      <textarea rows={2} value={item.requester_notes} onChange={(event) => updateItem(index, 'requester_notes', event.target.value)} />
                    </label>
                  </div>
                  <label className={styles.fileButton}>
                    <FileUp size={15} />
                    {item.file ? item.file.name : 'Foto ou anexo do item'}
                    <input type="file" onChange={(event) => updateItem(index, 'file', event.target.files?.[0] || null)} />
                  </label>
                </article>
              ))}
            </div>

            <datalist id="purchase-categories">
              {options.categories.map((category) => <option key={category.id} value={category.name} />)}
            </datalist>
            <datalist id="purchase-departments">
              {options.departments.map((department) => <option key={department.id} value={department.name} />)}
            </datalist>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button>
              <button type="button" className={styles.secondaryButton} onClick={() => submitRequest('draft')} disabled={saving}>
                {saving ? <Loader2 size={16} /> : <FileText size={16} />}
                Salvar rascunho
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => submitRequest('submit')} disabled={saving}>
                {saving ? <Loader2 size={16} /> : <Send size={16} />}
                Enviar ao almoxarifado
              </button>
            </div>
          </div>
        </div>
      )}

      {permanentDeleteModal && (
        <div className={styles.modalOverlay} onClick={closePermanentDeleteModal}>
          <div className={styles.smallModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Excluir pedido permanentemente?</h2>
                <p>Esta ação excluirá definitivamente o pedido e todos os seus dados relacionados. Não será possível recuperar essas informações.</p>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={closePermanentDeleteModal}
                disabled={Boolean(permanentDeleteLoadingId)}
              >
                <X size={19} />
              </button>
            </div>

            <div className={styles.deleteConfirmDetails}>
              <span>
                <small>Número do pedido</small>
                <strong>{getPermanentDeleteCode(permanentDeleteModal)}</strong>
              </span>
              <span>
                <small>Primeiro item</small>
                <strong>
                  {detail?.request?.id === permanentDeleteModal.id && detail?.items?.[0]
                    ? getItemDisplayName(detail.items[0])
                    : getRequestDisplayName(permanentDeleteModal)}
                </strong>
              </span>
              <span>
                <small>Solicitante</small>
                <strong>{permanentDeleteModal.requester?.nome || 'Solicitante não informado'}</strong>
              </span>
              <span>
                <small>Data da solicitação</small>
                <strong>{formatDate(permanentDeleteModal.submitted_at || permanentDeleteModal.created_at)}</strong>
              </span>
              <span>
                <small>Data do cancelamento</small>
                <strong>{formatDate(permanentDeleteModal.cancelled_at)}</strong>
              </span>
            </div>

            <label className={styles.confirmationField}>
              Digite {getPermanentDeleteCode(permanentDeleteModal)} para confirmar
              <input
                value={permanentDeleteCode}
                onChange={(event) => {
                  setPermanentDeleteCode(event.target.value);
                  setPermanentDeleteError('');
                }}
                disabled={Boolean(permanentDeleteLoadingId)}
                autoFocus
              />
            </label>
            {permanentDeleteError && (
              <div className={styles.inlineError}>{permanentDeleteError}</div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closePermanentDeleteModal}
                disabled={Boolean(permanentDeleteLoadingId)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.destructiveButton}
                onClick={deleteRequestPermanently}
                disabled={Boolean(permanentDeleteLoadingId)}
              >
                {permanentDeleteLoadingId ? <Loader2 size={16} /> : <Trash2 size={16} />}
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {actionModal && (
        <div className={styles.modalOverlay} onClick={() => !saving && setActionModal(null)}>
          <div className={styles.smallModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>
                  {actionModal.type === 'quote' && 'Registrar cotação'}
                  {actionModal.type === 'purchase' && 'Registrar compra'}
                  {actionModal.type === 'receive' && 'Registrar recebimento'}
                </h2>
                <p>{actionModal.item.description}</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setActionModal(null)} disabled={saving}>
                <X size={19} />
              </button>
            </div>

            <div className={styles.formGrid}>
              {actionModal.type !== 'receive' && (
                <label className={styles.formWide}>
                  Fornecedor
                  <input
                    list="purchase-suppliers"
                    value={actionForm.supplier_name}
                    onChange={(event) => setActionForm((current) => ({ ...current, supplier_name: event.target.value }))}
                  />
                </label>
              )}

              {actionModal.type === 'quote' && (
                <>
                  <label>CNPJ<input value={actionForm.cnpj} onChange={(event) => setActionForm((current) => ({ ...current, cnpj: event.target.value }))} /></label>
                  <label>Vendedor<input value={actionForm.seller_name} onChange={(event) => setActionForm((current) => ({ ...current, seller_name: event.target.value }))} /></label>
                  <label>Telefone<input value={actionForm.phone} onChange={(event) => setActionForm((current) => ({ ...current, phone: event.target.value }))} /></label>
                  <label>E-mail<input type="email" value={actionForm.email} onChange={(event) => setActionForm((current) => ({ ...current, email: event.target.value }))} /></label>
                  <label className={styles.formWide}>Link<input value={actionForm.link} onChange={(event) => setActionForm((current) => ({ ...current, link: event.target.value }))} /></label>
                </>
              )}

              {actionModal.type === 'purchase' && (
                <>
                  <label>Número do pedido<input value={actionForm.order_number} onChange={(event) => setActionForm((current) => ({ ...current, order_number: event.target.value }))} /></label>
                  <label>Data da compra<input type="date" value={actionForm.purchase_date} onChange={(event) => setActionForm((current) => ({ ...current, purchase_date: event.target.value }))} /></label>
                  <label>Previsão de entrega<input type="date" value={actionForm.expected_delivery_at} onChange={(event) => setActionForm((current) => ({ ...current, expected_delivery_at: event.target.value }))} /></label>
                  <label>Forma de pagamento<input value={actionForm.payment_method} onChange={(event) => setActionForm((current) => ({ ...current, payment_method: event.target.value }))} /></label>
                </>
              )}

              {actionModal.type !== 'receive' && (
                <>
                  <label>Quantidade<input type="number" min="0" step="0.001" value={actionForm.quantity} onChange={(event) => setActionForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
                  <label>Valor unitário<input type="number" min="0" step="0.01" value={actionForm.unit_price} onChange={(event) => setActionForm((current) => ({ ...current, unit_price: event.target.value }))} /></label>
                  <label>Frete<input type="number" min="0" step="0.01" value={actionForm.shipping_price} onChange={(event) => setActionForm((current) => ({ ...current, shipping_price: event.target.value }))} /></label>
                  <label>Desconto<input type="number" min="0" step="0.01" value={actionForm.discount} onChange={(event) => setActionForm((current) => ({ ...current, discount: event.target.value }))} /></label>
                </>
              )}

              {actionModal.type === 'quote' && (
                <>
                  <label>Prazo em dias<input type="number" min="0" value={actionForm.delivery_days} onChange={(event) => setActionForm((current) => ({ ...current, delivery_days: event.target.value }))} /></label>
                  <label>Validade<input type="date" value={actionForm.valid_until} onChange={(event) => setActionForm((current) => ({ ...current, valid_until: event.target.value }))} /></label>
                  <label>Pagamento<input value={actionForm.payment_method} onChange={(event) => setActionForm((current) => ({ ...current, payment_method: event.target.value }))} /></label>
                  <label>Status
                    <select value={actionForm.status} onChange={(event) => setActionForm((current) => ({ ...current, status: event.target.value }))}>
                      <option value="aguardando_retorno">Aguardando retorno</option>
                      <option value="selecionada">Selecionada</option>
                      <option value="descartada">Descartada</option>
                    </select>
                  </label>
                </>
              )}

              {actionModal.type === 'receive' && (
                <>
                  <label>Quantidade recebida<input type="number" min="0" step="0.001" value={actionForm.quantity_received} onChange={(event) => setActionForm((current) => ({ ...current, quantity_received: event.target.value }))} /></label>
                  <label>Estado
                    <select value={actionForm.condition_status} onChange={(event) => setActionForm((current) => ({ ...current, condition_status: event.target.value }))}>
                      {options.receipt_conditions.map((condition) => (
                        <option key={condition} value={condition}>{RECEIPT_CONDITION_LABELS[condition] || condition}</option>
                      ))}
                    </select>
                  </label>
                  <label>Data<input type="date" value={actionForm.received_at} onChange={(event) => setActionForm((current) => ({ ...current, received_at: event.target.value }))} /></label>
                  <label>Local de armazenamento<input value={actionForm.storage_location} onChange={(event) => setActionForm((current) => ({ ...current, storage_location: event.target.value }))} /></label>
                </>
              )}

              <label className={styles.formWide}>
                Observações
                <textarea rows={3} value={actionForm.notes} onChange={(event) => setActionForm((current) => ({ ...current, notes: event.target.value }))} />
              </label>
            </div>

            <datalist id="purchase-suppliers">
              {options.suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}
            </datalist>

            <label className={styles.fileButton}>
              <FileUp size={15} />
              {actionForm.files?.length ? `${actionForm.files.length} arquivo(s)` : 'Anexar proposta, nota ou comprovante'}
              <input type="file" multiple onChange={(event) => setActionForm((current) => ({ ...current, files: Array.from(event.target.files || []) }))} />
            </label>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setActionModal(null)} disabled={saving}>Cancelar</button>
              <button type="button" className={styles.primaryButton} onClick={submitAction} disabled={saving}>
                {saving ? <Loader2 size={16} /> : <CheckCircle2 size={16} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
