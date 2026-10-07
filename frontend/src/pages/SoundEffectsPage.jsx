import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Bomb,
  Box,
  Cat,
  ChevronDown,
  Cloud,
  Coffee,
  Gamepad2,
  Glasses,
  Hammer,
  LayoutGrid,
  Laugh,
  Lightbulb,
  List,
  MessageCircle,
  MonitorX,
  MousePointer2,
  Music4,
  Play,
  Search,
  ShieldCheck,
  Smile,
  Star,
  Upload,
  User,
  Users2,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import api from "../services/api";
import { connectSocket, syncSocketUser } from "../services/socket";
import styles from "../styles/SoundEffectsPage.module.css";

const SOUND_EFFECT_MAX_VOLUME = 0.56;
const SOUND_EFFECT_DEFAULT_VOLUME = 0.48;
const SOUND_EFFECT_ACK_TIMEOUT_MS = 12000;
const SOUND_UPLOAD_MAX_SIZE_BYTES = 8 * 1024 * 1024;
const SOUND_UPLOAD_ALLOWED_EXTENSIONS = [".mp3", ".wav", ".ogg", ".opus", ".webm", ".m4a", ".mp4", ".aac", ".flac"];
const DEFAULT_SOUND_EFFECTS = [
  { key: "faaaa", label: "FAAAA", path: "/sounds/faaaa.wav" },
  { key: "vine_boom", label: "Vine Boom", path: "/sounds/vine-boom.wav" },
  { key: "metal_pipe", label: "Metal Pipe", path: "/sounds/metal-pipe.wav" },
  { key: "windows_error", label: "Windows Error", path: "/sounds/windows-error.wav" },
  { key: "bruh", label: "Bruh", path: "/sounds/bruh.wav" },
  { key: "minecraft_cave", label: "Minecraft Cave", path: "/sounds/minecraft-cave.wav" },
];

const SOUND_ICON_RULES = [
  { match: ["faaaa"], Icon: Waves, categoria: "Meme", color: "#18e0c0" },
  { match: ["vine_boom", "vine boom", "vim boom", "boom"], Icon: Bomb, categoria: "Meme", color: "#a78bfa" },
  { match: ["metal_pipe", "metal pipe", "pipe", "cano"], Icon: Hammer, categoria: "Meme", color: "#fb923c" },
  { match: ["windows_error", "windows error", "windows"], Icon: MonitorX, categoria: "Sistema", color: "#38bdf8" },
  { match: ["bruh"], Icon: Laugh, categoria: "Meme", color: "#facc15" },
  { match: ["minecraft", "cave"], Icon: Box, categoria: "Jogo", color: "#4ade80" },
  { match: ["whatsapp"], Icon: MessageCircle, categoria: "Notificação", color: "#25d366" },
  { match: ["shelvis", "controle"], Icon: Gamepad2, categoria: "Jogo", color: "#f472b6" },
  { match: ["click-mouse", "click mouse", "click_mouse", "mouse", "click"], Icon: MousePointer2, categoria: "Interface", color: "#38bdf8" },
  { match: ["dexter"], Icon: Glasses, categoria: "Meme", color: "#60a5fa" },
  { match: ["esperto", "lampada"], Icon: Lightbulb, categoria: "Meme", color: "#facc15" },
  { match: ["peido", "fart"], Icon: Cloud, categoria: "Engraçado", color: "#f87171" },
  { match: ["usausa", "nota musical"], Icon: Music4, categoria: "Música", color: "#f472b6" },
  { match: ["mae-tem-cafe", "cafe"], Icon: Coffee, categoria: "Bebida", color: "#38bdf8" },
  { match: ["trompete", "trumpet"], Icon: Music4, categoria: "Instrumento", color: "#facc15" },
  { match: ["vinheta"], Icon: AudioLines, categoria: "Áudio", color: "#38bdf8" },
  { match: ["tadaaa", "tada"], Icon: Star, categoria: "Comemoração", color: "#facc15" },
  { match: ["alan"], Icon: User, categoria: "Pessoa", color: "#60a5fa" },
  { match: ["faassatt", "upload"], Icon: Upload, categoria: "Upload", color: "#38bdf8" },
  { match: ["miau", "gato", "cat", "mlau"], Icon: Cat, categoria: "Animal", color: "#fb923c" },
  { match: ["finjo"], Icon: Smile, categoria: "Engraçado", color: "#facc15" },
  { match: ["risada", "laugh", "riso", "hehe", "rindo"], Icon: Smile, categoria: "Engraçado", color: "#facc15" },
];

const obterExtensaoArquivoAudio = (filename = "") => {
  const nome = String(filename || "").toLowerCase();
  const index = nome.lastIndexOf(".");
  return index >= 0 ? nome.slice(index) : "";
};

const normalizarBusca = (valor = "") => (
  String(valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
);

const obterIniciais = (nome = "") => {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0][0] || "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] || "" : "";
  return `${primeira}${ultima}`.toUpperCase();
};

const obterMetadadosSom = (sound = {}) => {
  const referencia = normalizarBusca(`${sound.key || ""} ${sound.label || ""}`);
  const regra = SOUND_ICON_RULES.find((item) => (
    item.match.some((termo) => referencia.includes(normalizarBusca(termo)))
  ));

  return {
    Icon: regra?.Icon || Volume2,
    categoria: regra?.categoria || "Som",
    color: regra?.color || "#18e0c0",
  };
};

const formatarDuracaoSom = (segundos) => {
  if (!Number.isFinite(segundos) || segundos <= 0) return "";
  const total = Math.round(segundos);
  const minutos = Math.floor(total / 60);
  const restante = String(total % 60).padStart(2, "0");
  return `${minutos}:${restante}`;
};

const obterMensagemErroUploadAudio = (err) => {
  const erroApi = err.response?.data?.error;
  if (erroApi) return erroApi;
  if (err.response?.status === 401) return "Sua sessão expirou. Entre novamente.";
  if (err.response?.status === 403) return "Seu usuário não tem permissão para enviar áudio.";
  if (err.response?.status === 413) return "Áudio muito grande para o servidor. Use um arquivo de até 8 MB.";
  return "Não foi possível enviar o áudio. Verifique o formato do arquivo e tente novamente.";
};

const lerUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

export default function SoundEffectsPage({ embedded = false } = {}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("disparo");
  const [soundEffects, setSoundEffects] = useState(DEFAULT_SOUND_EFFECTS);
  const [usuarios, setUsuarios] = useState([]);
  const [permissionUsers, setPermissionUsers] = useState([]);
  const [permissions, setPermissions] = useState({ can_use: false, can_manage: false });
  const [permissionSearch, setPermissionSearch] = useState("");
  const [permissionSavingIds, setPermissionSavingIds] = useState([]);
  const [soundPanel, setSoundPanel] = useState({
    usuarioId: "",
    soundKey: DEFAULT_SOUND_EFFECTS[0].key,
    volume: SOUND_EFFECT_DEFAULT_VOLUME,
    status: "",
    statusType: "",
  });
  const [soundUploadFile, setSoundUploadFile] = useState(null);
  const [soundUploadLabel, setSoundUploadLabel] = useState("");
  const [enviandoUploadEfeitoSonoro, setEnviandoUploadEfeitoSonoro] = useState(false);
  const [enviandoEfeitoSonoro, setEnviandoEfeitoSonoro] = useState(false);
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [funcionarioQuery, setFuncionarioQuery] = useState("");
  const [funcionarioDropdownAberto, setFuncionarioDropdownAberto] = useState(false);
  const [soundSearch, setSoundSearch] = useState("");
  const [soundViewMode, setSoundViewMode] = useState("grid");
  const [soundDurations, setSoundDurations] = useState({});

  const token = useMemo(() => localStorage.getItem("token"), []);
  const user = useMemo(() => lerUsuarioLocal(), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const socketRef = useRef(null);
  const soundUploadInputRef = useRef(null);
  const soundPreviewAudioRef = useRef(null);
  const soundStatusTimeoutRef = useRef(null);
  const funcionarioBlurTimeoutRef = useRef(null);
  const carregandoDuracaoSomRef = useRef(new Set());

  const carregarPermissoes = useCallback(async () => {
    const { data } = await api.get("/sound-effects/permissions", { headers });
    setPermissionUsers(Array.isArray(data?.users) ? data.users : []);
  }, [headers]);

  const carregarPagina = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setErro("");

      const { data } = await api.get("/sound-effects", { headers });
      const listaSons = Array.isArray(data?.sounds) && data.sounds.length
        ? data.sounds
        : DEFAULT_SOUND_EFFECTS;
      const permissaoAtual = data?.permission || { can_use: false, can_manage: false };

      setSoundEffects(listaSons);
      setUsuarios(Array.isArray(data?.users) ? data.users : []);
      setPermissions(permissaoAtual);

      if (permissaoAtual.can_manage) {
        await carregarPermissoes();
      }
    } catch (err) {
      console.error("Erro ao carregar efeitos sonoros:", err);
      setErro(err.response?.data?.error || "Não foi possível carregar os efeitos sonoros.");
    } finally {
      setLoading(false);
    }
  }, [carregarPermissoes, headers, token]);

  useEffect(() => {
    carregarPagina();
  }, [carregarPagina]);

  useEffect(() => () => {
    window.clearTimeout(soundStatusTimeoutRef.current);
    window.clearTimeout(funcionarioBlurTimeoutRef.current);
    soundPreviewAudioRef.current?.pause?.();
  }, []);

  useEffect(() => {
    if (!token || !user?.id || !user?.empresa_id) return undefined;

    const socketInstance = connectSocket(token);
    socketRef.current = socketInstance;

    const sincronizar = () => {
      setSocketStatus("connected");
      syncSocketUser(user);
    };

    const desconectar = () => setSocketStatus("disconnected");
    const tentandoReconectar = () => setSocketStatus("reconnecting");

    const atualizarStatusUsuario = (data = {}) => {
      const usuarioId = Number(data.usuario_id);
      if (!usuarioId) return;

      const aplicarStatus = (usuario) => (
        Number(usuario.id) === usuarioId
          ? {
              ...usuario,
              status: data.status || usuario.status,
              ultimo_acesso: data.ultimo_acesso ?? usuario.ultimo_acesso,
            }
          : usuario
      );

      setUsuarios((atuais) => atuais.map(aplicarStatus));
      setPermissionUsers((atuais) => atuais.map(aplicarStatus));
    };

    socketInstance.on("connect", sincronizar);
    socketInstance.io.on("reconnect", sincronizar);
    socketInstance.io.on("reconnect_attempt", tentandoReconectar);
    socketInstance.on("disconnect", desconectar);
    socketInstance.on("user_status_changed", atualizarStatusUsuario);

    if (socketInstance.connected) sincronizar();

    return () => {
      socketInstance.off("connect", sincronizar);
      socketInstance.io.off("reconnect", sincronizar);
      socketInstance.io.off("reconnect_attempt", tentandoReconectar);
      socketInstance.off("disconnect", desconectar);
      socketInstance.off("user_status_changed", atualizarStatusUsuario);
    };
  }, [token, user]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.Audio !== "function") return;

    soundEffects.forEach((sound) => {
      if (!sound?.key || !sound?.path) return;
      if (carregandoDuracaoSomRef.current.has(sound.key)) return;
      carregandoDuracaoSomRef.current.add(sound.key);

      const audio = new window.Audio();
      audio.preload = "metadata";
      audio.addEventListener("loadedmetadata", () => {
        setSoundDurations((atuais) => ({ ...atuais, [sound.key]: audio.duration }));
      });
      audio.src = sound.path;
    });
  }, [soundEffects]);

  const soundEffectsByKey = useMemo(() => (
    Object.fromEntries(soundEffects.map((sound) => [sound.key, sound]))
  ), [soundEffects]);

  const usuariosOnline = useMemo(() => (
    usuarios.filter((usuario) => usuario.status === "online")
  ), [usuarios]);

  const funcionarioEfeitoSelecionado = useMemo(() => (
    usuarios.find((usuario) => Number(usuario.id) === Number(soundPanel.usuarioId)) || null
  ), [soundPanel.usuarioId, usuarios]);

  const funcionariosFiltrados = useMemo(() => {
    const termo = normalizarBusca(funcionarioQuery);
    if (!termo) return usuariosOnline;
    return usuariosOnline.filter((usuario) => normalizarBusca(usuario.nome).includes(termo));
  }, [funcionarioQuery, usuariosOnline]);

  const somEfeitoSelecionado = soundEffectsByKey[soundPanel.soundKey] || soundEffects[0] || DEFAULT_SOUND_EFFECTS[0];

  const soundsFiltrados = useMemo(() => {
    const termo = normalizarBusca(soundSearch);
    if (!termo) return soundEffects;

    return soundEffects.filter((sound) => {
      const { categoria } = obterMetadadosSom(sound);
      const origem = sound.custom ? "upload" : "sistema";
      return normalizarBusca(`${sound.label} ${categoria} ${origem}`).includes(termo);
    });
  }, [soundSearch, soundEffects]);

  const permissionUsersFiltrados = useMemo(() => {
    const termo = normalizarBusca(permissionSearch);
    if (!termo) return permissionUsers;

    return permissionUsers.filter((usuario) => (
      normalizarBusca(`${usuario.nome} ${usuario.email} ${usuario.setor_nome}`).includes(termo)
    ));
  }, [permissionSearch, permissionUsers]);

  useEffect(() => {
    if (!soundEffects.length) return;
    if (soundEffectsByKey[soundPanel.soundKey]) return;

    setSoundPanel((atual) => ({
      ...atual,
      soundKey: soundEffects[0].key,
    }));
  }, [soundEffects, soundEffectsByKey, soundPanel.soundKey]);

  const mostrarStatusEfeitoSonoro = (mensagem, tipo = "") => {
    window.clearTimeout(soundStatusTimeoutRef.current);
    setSoundPanel((atual) => ({
      ...atual,
      status: mensagem,
      statusType: tipo,
    }));

    if (mensagem) {
      soundStatusTimeoutRef.current = window.setTimeout(() => {
        setSoundPanel((atual) => ({
          ...atual,
          status: "",
          statusType: "",
        }));
      }, tipo === "success" ? 6000 : 9000);
    }
  };

  const alterarEfeitoSonoro = (campo, valor) => {
    setSoundPanel((atual) => ({
      ...atual,
      [campo]: valor,
      status: "",
      statusType: "",
    }));
  };

  const selecionarFuncionario = (usuario) => {
    window.clearTimeout(funcionarioBlurTimeoutRef.current);
    alterarEfeitoSonoro("usuarioId", String(usuario.id));
    setFuncionarioQuery("");
    setFuncionarioDropdownAberto(false);
  };

  const limparFuncionarioSelecionado = () => {
    alterarEfeitoSonoro("usuarioId", "");
    setFuncionarioQuery("");
  };

  const alterarVolumeEfeitoSonoro = (valor) => {
    const numero = Number(valor);
    const volumeSeguro = Math.max(0, Math.min(100, Number.isFinite(numero) ? numero : 48)) / 100;
    alterarEfeitoSonoro("volume", Math.min(SOUND_EFFECT_MAX_VOLUME, volumeSeguro));
  };

  const testarEfeitoSonoroLocal = async (soundKey = soundPanel.soundKey) => {
    const sound = soundEffectsByKey[soundKey];

    if (!sound || typeof window === "undefined" || typeof window.Audio !== "function") {
      mostrarStatusEfeitoSonoro("Não foi possível testar este som no navegador.", "error");
      return;
    }

    try {
      soundPreviewAudioRef.current?.pause?.();
      const audio = new window.Audio(sound.path);
      audio.volume = Math.min(SOUND_EFFECT_MAX_VOLUME, Number(soundPanel.volume) || SOUND_EFFECT_DEFAULT_VOLUME);
      audio.preload = "auto";
      soundPreviewAudioRef.current = audio;

      await audio.play();
      mostrarStatusEfeitoSonoro(`Teste local: ${sound.label}`, "success");
    } catch (err) {
      console.error("Erro ao testar efeito sonoro:", err);
      mostrarStatusEfeitoSonoro("O navegador bloqueou o áudio. Clique novamente para liberar o teste.", "error");
    }
  };

  const enviarEfeitoSonoro = async () => {
    const socketInstance = socketRef.current;
    const funcionario = usuarios.find((usuario) => Number(usuario.id) === Number(soundPanel.usuarioId));
    const sound = soundEffectsByKey[soundPanel.soundKey];

    if (!funcionario) {
      mostrarStatusEfeitoSonoro("Selecione um funcionário online.", "error");
      return;
    }

    if (funcionario.status !== "online") {
      mostrarStatusEfeitoSonoro("Funcionário não está conectado ao Chat Interno.", "error");
      return;
    }

    if (!sound) {
      mostrarStatusEfeitoSonoro("Selecione um efeito sonoro válido.", "error");
      return;
    }

    if (!socketInstance?.connected) {
      mostrarStatusEfeitoSonoro("Socket.IO ainda não conectou. Tente novamente em instantes.", "error");
      return;
    }

    setEnviandoEfeitoSonoro(true);
    mostrarStatusEfeitoSonoro("", "");

    await new Promise((resolve) => {
      let finalizado = false;
      const timeoutId = window.setTimeout(() => {
        if (finalizado) return;
        finalizado = true;
        mostrarStatusEfeitoSonoro("Tempo esgotado ao enviar o efeito sonoro.", "error");
        setEnviandoEfeitoSonoro(false);
        resolve();
      }, SOUND_EFFECT_ACK_TIMEOUT_MS);

      socketInstance.emit("admin:play-prank-sound", {
        target_user_id: Number(funcionario.id),
        sound_key: sound.key,
        volume: Math.min(SOUND_EFFECT_MAX_VOLUME, Number(soundPanel.volume) || SOUND_EFFECT_DEFAULT_VOLUME),
      }, (resposta = {}) => {
        if (finalizado) return;
        finalizado = true;
        window.clearTimeout(timeoutId);

        if (resposta.ok) {
          mostrarStatusEfeitoSonoro(resposta.message || `Som enviado para ${funcionario.nome}.`, "success");
        } else {
          mostrarStatusEfeitoSonoro(resposta.error || "Não foi possível enviar o efeito sonoro.", "error");
        }

        setEnviandoEfeitoSonoro(false);
        resolve();
      });
    });
  };

  const enviarUploadEfeitoSonoro = async (event) => {
    event.preventDefault();

    if (!soundUploadFile) {
      mostrarStatusEfeitoSonoro("Selecione um arquivo de áudio para enviar.", "error");
      return;
    }

    if (soundUploadFile.size > SOUND_UPLOAD_MAX_SIZE_BYTES) {
      mostrarStatusEfeitoSonoro("Áudio muito grande. Envie arquivos de até 8 MB.", "error");
      return;
    }

    const extensao = obterExtensaoArquivoAudio(soundUploadFile.name);
    if (!SOUND_UPLOAD_ALLOWED_EXTENSIONS.includes(extensao)) {
      mostrarStatusEfeitoSonoro("Formato inválido. Envie MP3, WAV, OGG, OPUS, WEBM, M4A/AAC ou FLAC.", "error");
      return;
    }

    const payload = new FormData();
    payload.append("audio", soundUploadFile);
    payload.append("label", soundUploadLabel.trim() || soundUploadFile.name.replace(/\.[^.]+$/, ""));

    try {
      setEnviandoUploadEfeitoSonoro(true);
      const { data } = await api.post("/sound-effects/upload", payload, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });

      const lista = Array.isArray(data?.sounds) && data.sounds.length ? data.sounds : DEFAULT_SOUND_EFFECTS;
      const sound = data?.sound;

      setSoundEffects(lista);
      setSoundUploadFile(null);
      setSoundUploadLabel("");
      if (soundUploadInputRef.current) {
        soundUploadInputRef.current.value = "";
      }

      if (sound?.key) {
        setSoundPanel((atual) => ({
          ...atual,
          soundKey: sound.key,
          status: `Áudio "${sound.label}" enviado e liberado para uso.`,
          statusType: "success",
        }));
      } else {
        mostrarStatusEfeitoSonoro("Áudio enviado e liberado para uso.", "success");
      }
    } catch (err) {
      console.error("Erro ao enviar áudio de efeito sonoro:", err);
      mostrarStatusEfeitoSonoro(obterMensagemErroUploadAudio(err), "error");
    } finally {
      setEnviandoUploadEfeitoSonoro(false);
    }
  };

  const alternarPermissaoUsuario = async (usuarioPermissao, enabled) => {
    const usuarioId = Number(usuarioPermissao.id);
    if (!usuarioId || usuarioPermissao.can_manage) return;

    try {
      setPermissionSavingIds((atuais) => [...atuais, usuarioId]);
      const { data } = await api.put(`/sound-effects/permissions/${usuarioId}`, {
        enabled,
      }, { headers });

      setPermissionUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      console.error("Erro ao salvar permissão de efeito sonoro:", err);
      mostrarStatusEfeitoSonoro(err.response?.data?.error || "Não foi possível salvar a permissão.", "error");
    } finally {
      setPermissionSavingIds((atuais) => atuais.filter((id) => id !== usuarioId));
    }
  };

  if (loading) {
    return (
      <main className={`${styles.page} ${embedded ? styles.pageEmbedded : ""}`.trim()}>
        <div className={styles.loading}>
          <span className={styles.loadingIcon}>
            <AudioLines size={22} />
          </span>
          Carregando efeitos sonoros...
        </div>
      </main>
    );
  }

  if (erro) {
    return (
      <main className={`${styles.page} ${embedded ? styles.pageEmbedded : ""}`.trim()}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>
              <AudioLines size={18} />
              Efeitos sonoros
            </h2>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.errorBox}>{erro}</div>
          </div>
        </section>
      </main>
    );
  }

  const maxVolumePercent = Math.round(SOUND_EFFECT_MAX_VOLUME * 100);
  const volumePercent = Math.round(soundPanel.volume * 100);
  const fillVolume = Math.max(0, Math.min(100, (volumePercent / maxVolumePercent) * 100));

  const socketLabel = socketStatus === "connected"
    ? "Socket.IO conectado"
    : socketStatus === "reconnecting"
      ? "Reconectando..."
      : "Socket.IO desconectado";

  return (
    <main className={`${styles.page} ${embedded ? styles.pageEmbedded : ""}`.trim()}>
      <section className={styles.hero}>
        <span className={styles.heroLines} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <div className={styles.heroTop}>
          <div className={styles.heroIdentity}>
            <span className={styles.heroIcon}>
              <AudioLines size={30} />
            </span>
            <div>
              <span className={styles.eyebrow}>Acesso rápido</span>
              <h1>Efeitos sonoros</h1>
              <p className={styles.heroSubtitle}>
                Dispare sons engraçados para os funcionários do NOC em tempo real.
              </p>
            </div>
          </div>

          <div className={styles.heroStats}>
            <span className={styles.statChip}>
              <Volume2 size={14} />
              {soundEffects.length} {soundEffects.length === 1 ? "som disponível" : "sons disponíveis"}
            </span>
            <span className={styles.statChip}>
              <Users2 size={14} />
              {usuariosOnline.length} {usuariosOnline.length === 1 ? "funcionário online" : "funcionários online"}
            </span>
            <span className={`${styles.statChip} ${styles[`socket_${socketStatus}`]}`}>
              <span className={styles.socketDot} />
              {socketLabel}
            </span>
          </div>
        </div>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="Efeitos sonoros">
        <button
          type="button"
          className={`${styles.tabButton} ${abaAtiva === "disparo" ? styles.tabActive : ""}`}
          onClick={() => setAbaAtiva("disparo")}
        >
          <Play size={16} />
          Disparo
        </button>
        {permissions.can_manage && (
          <button
            type="button"
            className={`${styles.tabButton} ${abaAtiva === "permissoes" ? styles.tabActive : ""}`}
            onClick={() => setAbaAtiva("permissoes")}
          >
            <ShieldCheck size={16} />
            Permissões
          </button>
        )}
      </div>

      {abaAtiva === "disparo" && (
        <>
          <div className={styles.content}>
          <div className={styles.panelGrid}>
            <div className={styles.leftColumn}>
              <section className={`${styles.card} ${styles.cardPadded}`}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.cardIconBlock}>
                    <Users2 size={18} />
                  </span>
                  <h2>Alvo do efeito</h2>
                </div>
                <p className={styles.cardHint}>Selecione o funcionário que irá receber o som.</p>

                  {funcionarioEfeitoSelecionado ? (
                    <div className={styles.targetCard}>
                      <span className={styles.targetAvatar} aria-hidden="true">
                        {obterIniciais(funcionarioEfeitoSelecionado.nome)}
                      </span>
                      <div className={styles.targetInfo}>
                        <strong>{funcionarioEfeitoSelecionado.nome}</strong>
                        <span>
                          <span
                            className={`${styles.statusDot} ${
                              funcionarioEfeitoSelecionado.status === "online"
                                ? styles.statusDotOnline
                                : styles.statusDotOffline
                            }`}
                          />
                          {funcionarioEfeitoSelecionado.status === "online"
                            ? "Online agora"
                            : "Não conectado ao Chat Interno"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.targetRemove}
                        onClick={limparFuncionarioSelecionado}
                        aria-label="Remover seleção"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className={styles.comboBox}>
                      <div className={styles.searchField}>
                        <input
                          type="text"
                          value={funcionarioQuery}
                          placeholder="Buscar funcionário..."
                          onFocus={() => setFuncionarioDropdownAberto(true)}
                          onBlur={() => {
                            funcionarioBlurTimeoutRef.current = window.setTimeout(() => {
                              setFuncionarioDropdownAberto(false);
                            }, 150);
                          }}
                          onChange={(event) => setFuncionarioQuery(event.target.value)}
                        />
                        <ChevronDown size={15} className={styles.comboChevron} />
                      </div>

                      {funcionarioDropdownAberto && (
                        <div className={styles.comboDropdown}>
                          {!funcionariosFiltrados.length && (
                            <div className={styles.comboEmpty}>Nenhum funcionário online.</div>
                          )}
                          {funcionariosFiltrados.map((usuario) => (
                            <button
                              key={usuario.id}
                              type="button"
                              className={styles.comboOption}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selecionarFuncionario(usuario);
                              }}
                            >
                              <span className={styles.comboOptionAvatar}>{obterIniciais(usuario.nome)}</span>
                              {usuario.nome}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </section>

              <section className={`${styles.card} ${styles.cardPadded} ${styles.cardVolume}`}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.cardIconBlock}>
                    <Volume2 size={18} />
                  </span>
                  <h2>Volume do disparo</h2>
                </div>
                <p className={styles.cardHint}>Ajuste o volume do som para o funcionário.</p>

                  <div className={styles.sliderBox}>
                    <input
                      type="range"
                      className={styles.volumeSlider}
                      min="0"
                      max={maxVolumePercent}
                      step="5"
                      value={volumePercent}
                      onChange={(event) => alterarVolumeEfeitoSonoro(event.target.value)}
                      style={{ "--fill": `${fillVolume}%` }}
                    />
                    <span className={styles.volumeValueInline}>{volumePercent}%</span>
                  </div>

                  <div className={styles.volumeScale}>
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>

                  <div className={styles.volumeNotice}>
                    Volume máximo remoto: {maxVolumePercent}%
                  </div>
              </section>
            </div>

            <section className={`${styles.card} ${styles.libraryCard}`}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.cardIconBlock}>
                    <Music4 size={18} />
                  </span>
                  <div>
                    <h2>Sons disponíveis</h2>
                    <p className={styles.cardHint}>Clique em um som para disparar no funcionário selecionado.</p>
                  </div>
                </div>

                <div className={styles.libraryTools}>
                  <div className={styles.searchField}>
                    <Search size={15} />
                    <input
                      type="search"
                      value={soundSearch}
                      onChange={(event) => setSoundSearch(event.target.value)}
                      placeholder="Buscar sons..."
                    />
                  </div>

                  <div className={styles.viewToggle}>
                    <button
                      type="button"
                      className={soundViewMode === "grid" ? styles.viewToggleActive : ""}
                      onClick={() => setSoundViewMode("grid")}
                      aria-pressed={soundViewMode === "grid"}
                      aria-label="Ver em grade"
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      type="button"
                      className={soundViewMode === "list" ? styles.viewToggleActive : ""}
                      onClick={() => setSoundViewMode("list")}
                      aria-pressed={soundViewMode === "list"}
                      aria-label="Ver em lista"
                    >
                      <List size={15} />
                    </button>
                  </div>

                  <span className={styles.libraryCount}>
                    {soundsFiltrados.length} {soundsFiltrados.length === 1 ? "som" : "sons"}
                  </span>
                </div>
              </div>

              <div className={styles.cardBody}>
                {!soundsFiltrados.length ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyStateIcon}>
                      <Search size={18} />
                    </span>
                    Nenhum som encontrado para essa busca.
                  </div>
                ) : soundViewMode === "grid" ? (
                  <div className={styles.soundsGrid}>
                    {soundsFiltrados.map((sound) => {
                      const ativo = soundPanel.soundKey === sound.key;
                      const { Icon, color } = obterMetadadosSom(sound);
                      const duracao = formatarDuracaoSom(soundDurations[sound.key]);

                      return (
                        <button
                          key={sound.key}
                          type="button"
                          className={`${styles.soundTile} ${ativo ? styles.soundTileActive : ""}`}
                          onClick={() => alterarEfeitoSonoro("soundKey", sound.key)}
                          aria-pressed={ativo}
                        >
                          <span className={styles.soundTileIcon} style={{ color }}>
                            <Icon size={22} />
                          </span>
                          <span className={styles.soundTileBody}>
                            <span className={styles.soundTileLabel}>{sound.label}</span>
                            {duracao && <span className={styles.soundTileDuration}>{duracao}</span>}
                            {sound.custom && (
                              <small className={styles.soundTileTag}>
                                <Upload size={9} />
                                Upload
                              </small>
                            )}
                          </span>
                          <span
                            className={styles.soundTilePlay}
                            role="button"
                            tabIndex={-1}
                            onClick={(event) => {
                              event.stopPropagation();
                              alterarEfeitoSonoro("soundKey", sound.key);
                              testarEfeitoSonoroLocal(sound.key);
                            }}
                            aria-label={`Testar ${sound.label}`}
                          >
                            <Play size={13} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.soundsList}>
                    <div className={styles.soundsListHeader}>
                      <span>Nome</span>
                      <span>Duração</span>
                      <span>Categoria</span>
                      <span>Origem</span>
                      <span>Ações</span>
                    </div>
                    {soundsFiltrados.map((sound) => {
                      const ativo = soundPanel.soundKey === sound.key;
                      const { Icon, categoria, color } = obterMetadadosSom(sound);
                      const duracao = formatarDuracaoSom(soundDurations[sound.key]);

                      return (
                        <button
                          key={sound.key}
                          type="button"
                          className={`${styles.soundsListRow} ${ativo ? styles.soundsListRowActive : ""}`}
                          onClick={() => alterarEfeitoSonoro("soundKey", sound.key)}
                          aria-pressed={ativo}
                        >
                          <span className={styles.soundsListName}>
                            <span className={styles.soundTileIcon} style={{ color }}>
                              <Icon size={16} />
                            </span>
                            {sound.label}
                            {sound.custom && <small className={styles.soundTileTag}>Upload</small>}
                          </span>
                          <span>{duracao || "—"}</span>
                          <span>{categoria}</span>
                          <span>{sound.custom ? "Upload" : "Sistema"}</span>
                          <span
                            className={styles.soundTilePlay}
                            role="button"
                            tabIndex={-1}
                            onClick={(event) => {
                              event.stopPropagation();
                              alterarEfeitoSonoro("soundKey", sound.key);
                              testarEfeitoSonoroLocal(sound.key);
                            }}
                            aria-label={`Testar ${sound.label}`}
                          >
                            <Play size={13} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <form className={styles.uploadDropzone} onSubmit={enviarUploadEfeitoSonoro}>
                  <div className={styles.uploadDropzoneHead}>
                    <span className={styles.uploadDropzoneIcon}>
                      <Upload size={16} />
                    </span>
                    <div>
                      <strong>Enviar novo áudio</strong>
                      <span>MP3, WAV, OGG, OPUS, WEBM, M4A/AAC ou FLAC até 8 MB.</span>
                    </div>
                  </div>
                  <div className={styles.uploadRow}>
                    <input
                      ref={soundUploadInputRef}
                      className={styles.uploadFileInput}
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/aac,audio/mp4,audio/m4a,audio/x-m4a,audio/flac,audio/x-flac,audio/wav,audio/ogg,audio/opus,audio/webm,video/webm,.mp3,.wav,.ogg,.opus,.webm,.m4a,.mp4,.aac,.flac"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setSoundUploadFile(file);
                        if (file && !soundUploadLabel) {
                          setSoundUploadLabel(file.name.replace(/\.[^.]+$/, ""));
                        }
                      }}
                    />
                    <input
                      type="text"
                      value={soundUploadLabel}
                      onChange={(event) => setSoundUploadLabel(event.target.value)}
                      maxLength="80"
                      placeholder="Nome do efeito"
                    />
                    <button
                      type="submit"
                      className={styles.secondaryButton}
                      disabled={enviandoUploadEfeitoSonoro || !soundUploadFile}
                    >
                      <Upload size={16} />
                      {enviandoUploadEfeitoSonoro ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </div>
          </div>

          <section className={styles.nowPlaying}>
            <div className={styles.nowPlayingInfo}>
              <span className={styles.nowPlayingIcon}>
                <AudioLines size={20} />
              </span>
              <div>
                <strong>{somEfeitoSelecionado.label}</strong>
                <span>Pronto para disparar a {volumePercent}% de volume</span>
              </div>
            </div>
            <div className={styles.nowPlayingActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => testarEfeitoSonoroLocal(soundPanel.soundKey)}
              >
                <Play size={17} />
                Testar no meu navegador
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={enviarEfeitoSonoro}
                disabled={enviandoEfeitoSonoro || !funcionarioEfeitoSelecionado || socketStatus !== "connected"}
              >
                <Volume2 size={17} />
                {enviandoEfeitoSonoro ? "Enviando..." : "Tocar no PC"}
              </button>
            </div>
          </section>

          {soundPanel.status && (
            <div
              className={`${styles.resultToast} ${
                soundPanel.statusType === "success"
                  ? styles.resultToastSuccess
                  : styles.resultToastError
              }`}
              role="status"
            >
              {soundPanel.status}
            </div>
          )}
        </>
      )}

      {abaAtiva === "permissoes" && permissions.can_manage && (
        <div className={styles.permissionsWrap}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>
              <ShieldCheck size={16} />
              Permissões
            </h2>
            <div className={styles.searchField}>
              <Search size={15} />
              <input
                type="search"
                value={permissionSearch}
                onChange={(event) => setPermissionSearch(event.target.value)}
                placeholder="Buscar usuário"
              />
            </div>
          </div>

          <div className={styles.cardBody}>
            {permissionUsersFiltrados.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyStateIcon}>
                  <Search size={18} />
                </span>
                Nenhum usuário encontrado para essa busca.
              </div>
            ) : (
              <div className={styles.permissionsGrid}>
                {permissionUsersFiltrados.map((usuarioPermissao) => {
                  const salvando = permissionSavingIds.includes(Number(usuarioPermissao.id));
                  const bloqueado = Boolean(usuarioPermissao.can_manage || salvando);

                  return (
                    <label key={usuarioPermissao.id} className={styles.permissionCard}>
                      <input
                        type="checkbox"
                        className={styles.srOnlyCheckbox}
                        checked={Boolean(usuarioPermissao.can_use)}
                        disabled={bloqueado}
                        onChange={(event) => alternarPermissaoUsuario(usuarioPermissao, event.target.checked)}
                      />
                      <span className={styles.permissionAvatar} aria-hidden="true">
                        {obterIniciais(usuarioPermissao.nome)}
                      </span>
                      <span className={styles.permissionInfo}>
                        <strong>{usuarioPermissao.nome}</strong>
                        <small>{usuarioPermissao.setor_nome || usuarioPermissao.email || "Sem setor"}</small>
                        <span className={styles.permissionBadges}>
                          <span className={`${styles.statusTag} ${
                            usuarioPermissao.status === "online" ? styles.statusTagOnline : ""
                          }`}>
                            {usuarioPermissao.status === "online" ? "Online" : "Offline"}
                          </span>
                          {usuarioPermissao.can_manage && (
                            <span className={styles.managerTag}>Gerencia</span>
                          )}
                        </span>
                      </span>
                      <span className={`${styles.toggleTrack} ${bloqueado ? styles.toggleTrackDisabled : ""}`} aria-hidden="true">
                        <span className={styles.toggleThumb} />
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </section>
        </div>
      )}
    </main>
  );
}
