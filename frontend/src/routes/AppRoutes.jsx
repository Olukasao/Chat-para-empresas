import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { BrowserNotificationProvider } from "../contexts/BrowserNotificationProvider";
import Login from "../pages/Login";
import AtendimentoSso from "../pages/AtendimentoSso";
import ChatPage from "../components/Chat/ChatPage";
import Admin from "../pages/Admin";
import AdminAvisosInternos from "../pages/AdminAvisosInternos";
import AdminBannerHome from "../pages/AdminBannerHome";
import AdminChatHistorico from "../pages/AdminChatHistorico";
import AdminUserHistory from "../pages/AdminUserHistory";
import AvisosInternos from "../pages/AvisosInternos";
import Imagens from "../pages/Imagens";
import Changelog from "../pages/Changelog";
import Wiki from "../pages/Wiki";
import GlobalSearch from "../pages/GlobalSearch";
import InternalRequests from "../pages/InternalRequests";
import PurchaseRequests from "../pages/PurchaseRequests";
import RequesterPurchaseRequests from "../pages/RequesterPurchaseRequests";
import NotasRapidas from "../pages/NotasRapidas";
import PlantaoDomingo from "../pages/PlantaoDomingo";
import BoasPraticasDuvidas from "../pages/BoasPraticasDuvidas";
import AssinaturasEmail from "../pages/AssinaturasEmail";
import AttendanceTextsPage from "../pages/AttendanceTextsPage";
import SemiDedicadoCalculatorPage from "../pages/SemiDedicadoCalculatorPage";
import AgreementCalculatorPage from "../pages/AgreementCalculatorPage";
import Vendas from "../pages/Vendas";
import FalhasGerais from "../pages/FalhasGerais";
import ConnectivityTestSites from "../pages/ConnectivityTestSites";
import PacketLossTest from "../pages/PacketLossTest";
import MonitoramentoTotal from "../pages/MonitoramentoTotal";
import DiagnosticoConexaoCliente from "../pages/DiagnosticoConexaoCliente";
import SoundEffectsPage from "../pages/SoundEffectsPage";
import CompeticaoCcna from "../pages/CompeticaoCcna";
import { BOAS_PRATICAS_ATENDIMENTO_PAGE_CONFIG } from "../pages/attendanceTextsPageConfig";
import IntranetCopaPreview from "../pages/IntranetCopaPreview";
import AdminPurchasePermissions from "../pages/AdminPurchasePermissions";
import ControleOperacional from "../pages/ControleOperacional";
import RoulettePage from "../pages/RoulettePage";
import RouletteAdmin from "../pages/RouletteAdmin";

const CONTROLE_OPERACIONAL_ENABLED = import.meta.env.VITE_CONTROLE_OPERACIONAL_ENABLED === "true";

const isAuthenticated = () => {
  return localStorage.getItem("token");
};

function PrivateRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <BrowserNotificationProvider>
        <Routes>
          <Route path="/atendimento-sso" element={<AtendimentoSso />} />
          <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <ChatPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <PrivateRoute>
              <ChatPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/intranet-copa-preview"
          element={
            <PrivateRoute>
              <IntranetCopaPreview />
            </PrivateRoute>
          }
        />

        <Route
          path="/avisos-internos"
          element={
            <PrivateRoute>
              <AvisosInternos />
            </PrivateRoute>
          }
        />

        <Route
          path="/imagens"
          element={
            <PrivateRoute>
              <Imagens />
            </PrivateRoute>
          }
        />

        <Route
          path="/wiki"
          element={
            <PrivateRoute>
              <Wiki />
            </PrivateRoute>
          }
        />

        <Route
          path="/wiki/:categoriaId"
          element={
            <PrivateRoute>
              <Wiki />
            </PrivateRoute>
          }
        />

        <Route
          path="/wiki/curso/:cursoId"
          element={
            <PrivateRoute>
              <Wiki />
            </PrivateRoute>
          }
        />

        <Route
          path="/wiki/curso/:cursoId/aula/:lessonSlug"
          element={
            <PrivateRoute>
              <Wiki />
            </PrivateRoute>
          }
        />

        <Route
          path="/wiki/curso/:cursoId/:courseSection"
          element={
            <PrivateRoute>
              <Wiki />
            </PrivateRoute>
          }
        />

        <Route
          path="/cursos"
          element={
            <PrivateRoute>
              <Wiki />
            </PrivateRoute>
          }
        />

        <Route
          path="/cursos/:categoriaId"
          element={
            <PrivateRoute>
              <Wiki />
            </PrivateRoute>
          }
        />

        <Route
          path="/cursos/curso/:cursoId"
          element={
            <PrivateRoute>
              <Wiki />
            </PrivateRoute>
          }
        />

        <Route
          path="/cursos/curso/:cursoId/aula/:lessonSlug"
          element={
            <PrivateRoute>
              <Wiki />
            </PrivateRoute>
          }
        />

        <Route
          path="/cursos/curso/:cursoId/:courseSection"
          element={
            <PrivateRoute>
              <Wiki />
            </PrivateRoute>
          }
        />

        <Route
          path="/busca-global"
          element={
            <PrivateRoute>
              <GlobalSearch />
            </PrivateRoute>
          }
        />

        <Route
          path="/solicitacoes-internas"
          element={
            <PrivateRoute>
              <InternalRequests />
            </PrivateRoute>
          }
        />

        <Route
          path="/solicitacoes"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<RequesterPurchaseRequests />} hideDashboardSidebar />
            </PrivateRoute>
          }
        />

        <Route
          path="/solicitacoes-compras"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<PurchaseRequests />} hideDashboardSidebar />
            </PrivateRoute>
          }
        />

        <Route
          path="/painel-almoxarifado"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<PurchaseRequests />} hideDashboardSidebar />
            </PrivateRoute>
          }
        />

        <Route
          path="/changelog"
          element={
            <PrivateRoute>
              <Changelog />
            </PrivateRoute>
          }
        />

        <Route
          path="/notas-rapidas"
          element={
            <PrivateRoute>
              <NotasRapidas />
            </PrivateRoute>
          }
        />

        <Route
          path="/plantao-domingo"
          element={
            <PrivateRoute>
              <PlantaoDomingo />
            </PrivateRoute>
          }
        />

        <Route
          path="/boas-praticas-duvidas"
          element={
            <PrivateRoute>
              <BoasPraticasDuvidas />
            </PrivateRoute>
          }
        />

        <Route
          path="/textos-atendimento"
          element={
            <PrivateRoute>
              <AttendanceTextsPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/boas-praticas-atendimento"
          element={
            <PrivateRoute>
              <AttendanceTextsPage config={BOAS_PRATICAS_ATENDIMENTO_PAGE_CONFIG} />
            </PrivateRoute>
          }
        />

        <Route
          path="/acesso-rapido/vendas"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<Vendas embedded />} />
            </PrivateRoute>
          }
        />

        <Route
          path="/vendas"
          element={
            <PrivateRoute>
              <Navigate to="/acesso-rapido/vendas" replace />
            </PrivateRoute>
          }
        />

        <Route
          path="/acesso-rapido/falhas-gerais"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<FalhasGerais embedded />} />
            </PrivateRoute>
          }
        />

        <Route
          path="/teste-conectividade-sites"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<ConnectivityTestSites embedded />} />
            </PrivateRoute>
          }
        />

        <Route
          path="/acesso-rapido/efeitos-sonoros"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<SoundEffectsPage embedded />} hideDashboardSidebar />
            </PrivateRoute>
          }
        />

        <Route
          path="/teste-perda-pacote"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<PacketLossTest embedded />} />
            </PrivateRoute>
          }
        />

        <Route
          path="/diagnostico-conexao-cliente"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<DiagnosticoConexaoCliente embedded />} hideDashboardSidebar />
            </PrivateRoute>
          }
        />

        <Route
          path="/monitoramento-total"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<MonitoramentoTotal embedded />} hideDashboardSidebar />
            </PrivateRoute>
          }
        />

        <Route
          path="/controle-operacional"
          element={
            <PrivateRoute>
              {CONTROLE_OPERACIONAL_ENABLED ? <ControleOperacional /> : <Navigate to="/chat" replace />}
            </PrivateRoute>
          }
        />

        <Route
          path="/competicao-ccna"
          element={
            <PrivateRoute>
              <CompeticaoCcna />
            </PrivateRoute>
          }
        />

        <Route
          path="/roleta-premios"
          element={
            <PrivateRoute>
              <ChatPage internalPage={<RoulettePage />} hideDashboardSidebar />
            </PrivateRoute>
          }
        />

        <Route
          path="/intranet/competicao-ccna"
          element={
            <PrivateRoute>
              <Navigate to="/competicao-ccna" replace />
            </PrivateRoute>
          }
        />

        <Route
          path="/noc/monitoramento-total"
          element={
            <PrivateRoute>
              <Navigate to="/monitoramento-total" replace />
            </PrivateRoute>
          }
        />

        <Route
          path="/noc/teste-conectividade-sites"
          element={
            <PrivateRoute>
              <Navigate to="/teste-conectividade-sites" replace />
            </PrivateRoute>
          }
        />

        <Route
          path="/falhas-gerais"
          element={
            <PrivateRoute>
              <Navigate to="/acesso-rapido/falhas-gerais" replace />
            </PrivateRoute>
          }
        />

        <Route
          path="/acesso-rapido/calculadora-semi-dedicado"
          element={
            <PrivateRoute>
              <SemiDedicadoCalculatorPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/acesso-rapido/calculadora-acordo"
          element={
            <PrivateRoute>
              <AgreementCalculatorPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/assinaturas-email"
          element={
            <PrivateRoute>
              <AssinaturasEmail />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <Admin />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/avisos-internos"
          element={
            <PrivateRoute>
              <AdminAvisosInternos />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/banner-home"
          element={
            <PrivateRoute>
              <AdminBannerHome />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/usuarios/:id/mensagens"
          element={
            <PrivateRoute>
              <AdminUserHistory />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/chat-historico"
          element={
            <PrivateRoute>
              <AdminChatHistorico />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/permissoes-compras"
          element={
            <PrivateRoute>
              <AdminPurchasePermissions />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/roleta-premios"
          element={
            <PrivateRoute>
              <RouletteAdmin />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserNotificationProvider>
    </BrowserRouter>
  );
}
