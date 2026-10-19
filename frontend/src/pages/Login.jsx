import { useState } from "react";
import { motion, MotionConfig, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, Zap, FileText, Users, Play } from "lucide-react";
import IntroVideo from "../components/IntroVideo";
// Logotipo oficial do AcessaNetLab (public/design-system/brand).
const logo = "/design-system/brand/acessanet-logo.png";
import api from "../services/api";
import { useLocation, useNavigate } from "react-router-dom";

const prepararAudioChat = () => {
    if (typeof window === "undefined") return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
        window.__chatAudioContext = window.__chatAudioContext || new AudioContextClass();
        window.__chatAudioContext.resume?.();
    } catch {
        // Navegadores sem suporte apenas seguem sem pre-aquecer o som.
    }
};

// Mesma chave que o IntroVideo grava ao terminar o vídeo.
const introVideoJaAssistido = () => {
    try {
        return localStorage.getItem("introVideoWatched") === "1";
    } catch {
        return false;
    }
};

const obterRedirectSeguro = (search) => {
    const redirect = new URLSearchParams(search).get("redirect");

    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
        return redirect;
    }

    return "/";
};

const BENEFICIOS = [
    { icon: Zap, texto: "Comunicação em tempo real" },
    { icon: FileText, texto: "Arquivos e notas rápidas" },
    { icon: Users, texto: "Equipes e grupos internos" },
];

const MENSAGENS_ILUSTRATIVAS = [
    {
        nome: "Suporte",
        texto: "Cliente voltou online 👍",
        cor: "from-[#3ad6ff] to-[#2f6bff]",
        className: "right-[6%] top-[8%] xl:right-[10%]",
        delay: 0.5,
    },
    {
        nome: "NOC",
        texto: "Rota normalizada",
        cor: "from-emerald-400 to-teal-500",
        className: "right-[-2%] top-[46%] xl:right-[2%]",
        delay: 0.75,
    },
    {
        nome: "Equipe",
        texto: "Novo arquivo compartilhado",
        cor: "from-[#8fb2ff] to-[#2f6bff]",
        className: "right-[14%] bottom-[6%] xl:right-[18%]",
        delay: 1,
    },
];

const MotionDiv = motion.div;
const MotionP = motion.p;
const MotionButton = motion.button;

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [capsLockAtivo, setCapsLockAtivo] = useState(false);
    const [erro, setErro] = useState("");
    const [carregando, setCarregando] = useState(false);
    // A apresentação abre sozinha só na primeira visita; depois, pelo botão "Ver apresentação".
    const [mostrarVideo, setMostrarVideo] = useState(() => !introVideoJaAssistido());
    const navigate = useNavigate();
    const location = useLocation();

    const handleSenhaKeyEvent = (e) => {
        if (typeof e.getModifierState === "function") {
            setCapsLockAtivo(e.getModifierState("CapsLock"));
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        prepararAudioChat();
        setErro("");
        setCarregando(true);

        try {
            const { data } = await api.post("/login", {
                email,
                senha: password,
            });

            if (!data.token) {
                setErro("Token não recebido. Tente novamente.");
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            navigate(obterRedirectSeguro(location.search), { replace: true });
        } catch (err) {
            console.error(err);
            setErro(err.response?.data?.error || "Não foi possível entrar. Verifique seus dados.");
        } finally {
            setCarregando(false);
        }
    };

    return (
        <MotionConfig reducedMotion="user">
            {mostrarVideo && <IntroVideo onClose={() => setMostrarVideo(false)} />}
            <div className="min-h-screen w-full flex bg-[var(--an-navy-900)] text-[var(--an-on-dark)] relative overflow-hidden [font-family:var(--an-font-body)]">
                {/* Background premium */}
                <div className="pointer-events-none absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#10224a_0%,#050b1f_55%,#030716_100%)]" />
                    <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-[#2f6bff]/25 blur-[120px]" />
                    <div className="absolute bottom-[-15%] right-[-10%] h-[480px] w-[480px] rounded-full bg-[#4f86ff]/15 blur-[130px]" />
                    <div className="absolute top-[30%] right-[15%] h-[220px] w-[220px] rounded-full bg-[#3ad6ff]/10 blur-[100px]" />
                    <div
                        className="absolute inset-0 opacity-[0.05]"
                        style={{
                            backgroundImage:
                                "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
                            backgroundSize: "42px 42px",
                        }}
                    />
                </div>

                {/* Lado esquerdo - branding */}
                <div className="hidden md:flex md:w-[58%] relative z-10 flex-col justify-center px-16 lg:px-20 overflow-hidden">
                    <MotionDiv
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-md relative z-10"
                    >
                        <div className="flex items-center gap-3 mb-10">
                            <img
                                src={logo}
                                alt="AcessaNet"
                                width="107"
                                height="40"
                                className="h-10 w-auto drop-shadow-[0_6px_18px_rgba(47,107,255,0.45)]"
                            />
                        </div>

                        <h1 className="text-5xl lg:text-6xl font-bold leading-[1.02] tracking-[-0.03em] mb-5 [font-family:var(--an-font-display)]">
                            Chat Interno
                        </h1>

                        <p className="text-[var(--an-on-dark-2)] text-lg mb-10 leading-relaxed max-w-sm">
                            Comunicação, arquivos e colaboração em um só lugar.
                        </p>

                        <ul className="space-y-4">
                            {BENEFICIOS.map((beneficio) => {
                                const Icon = beneficio.icon;
                                return (
                                    <li key={beneficio.texto} className="flex items-center gap-3 text-white/80">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#2f6bff]/10 border border-[#4f86ff]/25 text-[#8fb2ff]">
                                            <Icon size={16} strokeWidth={2} aria-hidden="true" />
                                        </span>
                                        <span className="text-sm">{beneficio.texto}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </MotionDiv>

                    {/* Composição visual - cards flutuantes */}
                    <div className="absolute inset-0 z-0" aria-hidden="true">
                        {MENSAGENS_ILUSTRATIVAS.map((msg) => (
                            <MotionDiv
                                key={msg.nome}
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: msg.delay, ease: "easeOut" }}
                                className={`absolute ${msg.className} w-56 rounded-[14px] border border-[#8fb2ff]/15 bg-[#0a1633]/75 backdrop-blur-md shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] p-3.5`}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span
                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${msg.cor} text-[10px] font-bold text-white`}
                                    >
                                        {msg.nome.charAt(0)}
                                    </span>
                                    <span className="text-xs font-semibold text-white/90 [font-family:var(--an-font-display)]">{msg.nome}</span>
                                </div>
                                <p className="text-xs text-white/60 leading-snug">{msg.texto}</p>
                            </MotionDiv>
                        ))}
                    </div>
                </div>

                {/* Lado direito - login */}
                <div className="w-full md:w-[42%] flex items-center justify-center px-5 sm:px-8 py-10 relative z-10">
                    <MotionDiv
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-[420px]"
                    >
                        <div className="rounded-[22px] border border-[#8fb2ff]/15 bg-[#0a1633]/80 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_30px_80px_-24px_rgba(0,0,0,0.85)] p-8 sm:p-10">
                            <div className="flex items-center gap-3 mb-8 md:hidden">
                                <img src={logo} alt="AcessaNet" width="80" height="30" className="h-[30px] w-auto" />
                                <span className="h-5 w-px bg-[#8fb2ff]/25" aria-hidden="true" />
                                <span className="text-[15px] font-bold tracking-[-0.02em] [font-family:var(--an-font-display)]">
                                    Chat Interno
                                </span>
                            </div>

                            <div className="mb-8">
                                <h2 className="text-[26px] font-bold tracking-[-0.02em] text-white [font-family:var(--an-font-display)]">Bem-vindo</h2>
                                <p className="text-[var(--an-on-dark-2)] text-sm mt-1.5">
                                    Acesse sua conta para continuar no Chat Interno.
                                </p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-5" noValidate>
                                <div>
                                    <label htmlFor="login-email" className="block text-sm font-semibold text-[var(--an-on-dark-2)] mb-1.5">
                                        E-mail
                                    </label>
                                    <div className="relative">
                                        <Mail
                                            size={18}
                                            strokeWidth={2}
                                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="login-email"
                                            type="email"
                                            autoComplete="username"
                                            placeholder="seu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            aria-required="true"
                                            className="w-full h-[50px] pl-11 pr-4 rounded-[10px] bg-[#030716]/60 border border-[#8fb2ff]/20 text-white placeholder:text-white/30 outline-none transition-[border-color,box-shadow] duration-200 hover:border-[#8fb2ff]/35 focus:border-[#4f86ff] focus:ring-[3px] focus:ring-[#2f6bff]/25"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="login-senha" className="block text-sm font-semibold text-[var(--an-on-dark-2)] mb-1.5">
                                        Senha
                                    </label>
                                    <div className="relative">
                                        <Lock
                                            size={18}
                                            strokeWidth={2}
                                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="login-senha"
                                            type={mostrarSenha ? "text" : "password"}
                                            autoComplete="current-password"
                                            placeholder="••••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onKeyDown={handleSenhaKeyEvent}
                                            onKeyUp={handleSenhaKeyEvent}
                                            required
                                            aria-required="true"
                                            className="w-full h-[50px] pl-11 pr-11 rounded-[10px] bg-[#030716]/60 border border-[#8fb2ff]/20 text-white placeholder:text-white/30 outline-none transition-[border-color,box-shadow] duration-200 hover:border-[#8fb2ff]/35 focus:border-[#4f86ff] focus:ring-[3px] focus:ring-[#2f6bff]/25"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setMostrarSenha((v) => !v)}
                                            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/75 transition-colors focus:outline-none focus-visible:text-[#3ad6ff]"
                                        >
                                            {mostrarSenha ? (
                                                <EyeOff size={18} strokeWidth={2} aria-hidden="true" />
                                            ) : (
                                                <Eye size={18} strokeWidth={2} aria-hidden="true" />
                                            )}
                                        </button>
                                    </div>
                                    <AnimatePresence>
                                        {capsLockAtivo && (
                                            <MotionP
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="mt-1.5 text-xs text-amber-300/80"
                                            >
                                                Caps Lock ativado.
                                            </MotionP>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <AnimatePresence>
                                    {erro && (
                                        <MotionDiv
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            role="alert"
                                            aria-live="assertive"
                                            className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3.5 py-3 text-sm text-red-300"
                                        >
                                            <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
                                            <span>{erro}</span>
                                        </MotionDiv>
                                    )}
                                </AnimatePresence>

                                <MotionButton
                                    type="submit"
                                    disabled={carregando}
                                    whileHover={carregando ? undefined : { y: -1 }}
                                    whileTap={carregando ? undefined : { y: 0 }}
                                    aria-busy={carregando}
                                    className="w-full h-[52px] rounded-full font-bold text-white bg-[#2f6bff] hover:bg-[#4f86ff] transition-colors duration-200 shadow-[0_10px_30px_-10px_rgba(47,107,255,0.8),inset_0_1px_0_rgba(255,255,255,0.22)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3ad6ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1633]"
                                >
                                    {carregando ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                                            Entrando...
                                        </>
                                    ) : (
                                        "Entrar no Chat"
                                    )}
                                </MotionButton>
                            </form>

                            <button
                                type="button"
                                onClick={() => setMostrarVideo(true)}
                                className="mt-3 w-full h-[46px] rounded-full border border-[#8fb2ff]/20 bg-transparent text-sm font-semibold text-white/80 hover:text-white hover:border-[#4f86ff]/60 hover:bg-[#2f6bff]/10 transition-colors duration-200 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3ad6ff]"
                            >
                                <Play size={16} strokeWidth={2.2} aria-hidden="true" />
                                Ver apresentação
                            </button>

                            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--an-on-dark-3)]">
                                <Lock size={12} strokeWidth={2.2} aria-hidden="true" />
                                A mesma conta dá acesso à Agenda Técnicos.
                            </p>

                            <div className="mt-6 pt-5 border-t border-[#8fb2ff]/10 text-center text-xs text-white/35">
                                © {new Date().getFullYear()} Acessa Net • Chat Interno
                            </div>
                        </div>
                    </MotionDiv>
                </div>
            </div>
        </MotionConfig>
    );
}
