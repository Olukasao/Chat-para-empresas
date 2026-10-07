/* eslint-disable */
/**
 * Exemplo de como integrar Chat em um componente Header/Navbar existente
 * Este arquivo mostra as alterações necessárias para adicionar botão "Chat Interno"
 */

import { Link } from 'react-router-dom';
import styles from './Header.module.css'; // Seus estilos existentes

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        {/* Logo */}
        <div className={styles.logo}>
          <h1>Minha Empresa</h1>
        </div>

        {/* Menu Principal */}
        <nav className={styles.nav}>
          <Link to="/" className={styles.navLink}>
            Dashboard
          </Link>
          <Link to="/perfil" className={styles.navLink}>
            Perfil
          </Link>
          
          {/* 🔥 NOVO: BOTÃO CHAT INTERNO */}
          <Link 
            to="/chat" 
            className={`${styles.navLink} ${styles.chatLink}`}
            title="Abrir Chat Interno"
          >
            💬 Chat Interno
          </Link>
          {/* FIM DO NOVO */}

          <button className={styles.logoutBtn}>
            Sair
          </button>
        </nav>
      </div>
    </header>
  );
}

/**
 * ============================================
 * ESTILOS CSS (Header.module.css)
 * ============================================
 */

/**
export const headerStyles = `
.header {
  background-color: #fff;
  border-bottom: 1px solid #e5e5e5;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.headerContent {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.logo h1 {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: #075E54;
}

.nav {
  display: flex;
  align-items: center;
  gap: 24px;
}

.navLink {
  color: #666;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
  padding: 8px 12px;
  border-radius: 4px;
}

.navLink:hover {
  color: #075E54;
  background-color: #f5f5f5;
}

// 🔥 NOVO: Estilo especial para Chat
.chatLink {
  background-color: #075E54;
  color: white;
  padding: 8px 16px;
}

.chatLink:hover {
  background-color: #128C7E;
  color: white;
}
// FIM DO NOVO

.logoutBtn {
  padding: 8px 16px;
  background-color: #f44444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}

.logoutBtn:hover {
  background-color: #d32f2f;
}
`;
*/

/**
 * ============================================
 * ALTERNATIVA 1: Usar ícone com notificação
 * ============================================
 */

export function HeaderComNotificacao() {
  const [mensagensNaoLidas, setMensagensNaoLidas] = null; // Atualizar via Socket.IO
  
  return (
    <header>
      {/* ... */}
      <Link 
        to="/chat" 
        className={styles.chatLink}
        title="Chat Interno"
      >
        💬
        {/* Badge de notificação */}
        {mensagensNaoLidas > 0 && (
          <span className={styles.badge}>
            {mensagensNaoLidas}
          </span>
        )}
      </Link>
      {/* ... */}
    </header>
  );
}

/**
 * ============================================
 * ALTERNATIVA 2: Menu dropdown com opções
 * ============================================
 */

export function HeaderComDropdown() {
  const [dropdownAberto, setDropdownAberto] = null;

  return (
    <header>
      {/* ... */}
      <div className={styles.menu}>
        <button onClick={() => setDropdownAberto(!dropdownAberto)}>
          ☰ Menu
        </button>
        
        {dropdownAberto && (
          <div className={styles.dropdown}>
            <Link to="/" onClick={() => setDropdownAberto(false)}>
              Home
            </Link>
            <Link to="/perfil" onClick={() => setDropdownAberto(false)}>
              Perfil
            </Link>
            <Link to="/chat" onClick={() => setDropdownAberto(false)}>
              💬 Chat Interno
            </Link>
            <button onClick={() => {
              // logout
              setDropdownAberto(false);
            }}>
              Sair
            </button>
          </div>
        )}
      </div>
      {/* ... */}
    </header>
  );
}

/**
 * ============================================
 * INTEGRAÇÃO NO APP PRINCIPAL (App.jsx)
 * ============================================
 * 
 * Se você tiver um layout principal que envolve
 * todas as páginas, adicione o Header lá:
 */

/**
export default function App() {
  return (
    <>
      <Header />
      <main>
        <AppRoutes />
      </main>
    </>
  );
}
*/

/**
 * ============================================
 * ALTERNATIVA 3: Botão flutuante (Floating)
 * ============================================
 */

export function FloatingChatButton() {
  return (
    <a 
      href="/chat"
      className={styles.floatingButton}
      title="Chat Interno"
    >
      💬
    </a>
  );
}

/**
CSS para botão flutuante:
.floatingButton {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  background-color: #075E54;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 999;
  transition: all 0.3s;
  text-decoration: none;
}

.floatingButton:hover {
  background-color: #128C7E;
  transform: scale(1.1);
}

.floatingButton:active {
  transform: scale(0.95);
}
*/

/**
 * ============================================
 * COMO USAR NOTIFICAÇÕES VIA SOCKET.IO
 * ============================================
 */

export function HeaderComSocket() {
  const [mensagensNaoLidas, setMensagensNaoLidas] = null;

  // Conectar ao Socket.IO
  useEffect(() => {
    const socket = io(`http://${window.location.hostname}:8600`);

    // Atualizar contador quando receberMessage
    socket.on('receive_direct_message', (data) => {
      setMensagensNaoLidas(prev => prev + 1);
    });

    socket.on('receive_group_message', (data) => {
      setMensagensNaoLidas(prev => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <header>
      {/* ... */}
      <Link to="/chat" className={styles.chatLink}>
        💬 Chat
        {mensagensNaoLidas > 0 && (
          <span className={styles.notificationBadge}>
            {mensagensNaoLidas}
          </span>
        )}
      </Link>
      {/* ... */}
    </header>
  );
}

/**
 * ============================================
 * PROTECTED ROUTE COM CHAT
 * ============================================
 */

export function ProtectedLayout({ children }) {
  const isAuthenticated = localStorage.getItem('token');

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}

/**
 * Uso em AppRoutes.jsx:
 * 
 * <Route element={<ProtectedLayout><Home /></ProtectedLayout>} path="/" />
 * <Route element={<ProtectedLayout><ChatPage /></ProtectedLayout>} path="/chat" />
 */

/**
 * ============================================
 * SETUP RÁPIDO
 * ============================================
 * 
 * 1. Importe o componente Header no seu layout principal
 * 2. Adicione o Link para "/chat"
 * 3. Estilize conforme seu design
 * 4. Pronto!
 * 
 * O routing já está configurado em AppRoutes.jsx
 */
