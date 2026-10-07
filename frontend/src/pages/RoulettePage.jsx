import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CircleHelp,
  Crown,
  Gift,
  History,
  Medal,
  RotateCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import api from "../services/api";
import styles from "../styles/RoulettePage.module.css";

const PENDING_SPIN_STORAGE_KEY = "roulettePendingSpinRequest";
const SOUND_STORAGE_KEY = "rouletteSoundEnabled";
const SPIN_DURATION_MS = 5200;
const REDUCED_SPIN_DURATION_MS = 900;
const CONFETTI_COUNT = 34;
const TABS = [
  { id: "wheel", label: "Roleta", icon: Trophy },
  { id: "prizes", label: "Meus Prêmios", icon: Gift },
  { id: "history", label: "Histórico", icon: History },
  { id: "rules", label: "Regras", icon: ScrollText },
];

const getToken = () => localStorage.getItem("token") || "";

const getHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const normalizeStatus = (status = "") => (
  String(status || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
);

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;

  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians)),
  };
};

const describeSlice = (startAngle, endAngle) => {
  const start = polarToCartesian(50, 50, 48, endAngle);
  const end = polarToCartesian(50, 50, 48, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", 50, 50,
    "L", start.x, start.y,
    "A", 48, 48, 0, largeArcFlag, 0, end.x, end.y,
    "Z",
  ].join(" ");
};

const abbreviateLabel = (value = "") => {
  const text = String(value || "").trim();

  if (text.length <= 16) return text;

  const words = text.split(/\s+/);
  if (words.length > 1) {
    return `${words[0]} ${words[1]}`.slice(0, 16);
  }

  return `${text.slice(0, 13)}...`;
};

function RouletteWheel({ prizes, rotation, transition }) {
  const segmentAngle = prizes.length > 0 ? 360 / prizes.length : 360;

  return (
    <div className={styles.wheelStage}>
      <div className={styles.pointer} aria-hidden="true" />
      <div
        className={styles.wheel}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition,
        }}
        aria-label="Roleta de prêmios"
        role="img"
      >
        <svg viewBox="0 0 100 100" className={styles.wheelSvg}>
          <defs>
            <radialGradient id="rouletteHubGlow" cx="50%" cy="50%" r="62%">
              <stop offset="0%" stopColor="#dff9ff" stopOpacity="0.98" />
              <stop offset="35%" stopColor="#00d4ff" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#041226" stopOpacity="0.92" />
            </radialGradient>
          </defs>

          {prizes.length > 0 ? prizes.map((prize, index) => {
            const startAngle = index * segmentAngle;
            const endAngle = startAngle + segmentAngle;
            const middleAngle = startAngle + segmentAngle / 2;
            const textPoint = polarToCartesian(50, 50, 30, middleAngle);
            const iconPoint = polarToCartesian(50, 50, 38, middleAngle);
            const segmentColor = prize.color || (index % 2 === 0 ? "#00d4ff" : "#123b6d");

            return (
              <g key={prize.id || index}>
                <path
                  d={describeSlice(startAngle, endAngle)}
                  fill={segmentColor}
                  className={styles.segment}
                  style={{ "--segment-index": index }}
                />
                <path
                  d={describeSlice(startAngle + 0.35, endAngle - 0.35)}
                  fill="rgba(2, 8, 23, 0.18)"
                  className={styles.segmentShade}
                />
                <text
                  x={iconPoint.x}
                  y={iconPoint.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={styles.segmentIcon}
                  transform={`rotate(${middleAngle}, ${iconPoint.x}, ${iconPoint.y})`}
                >
                  {prize.icon || "$"}
                </text>
                <text
                  x={textPoint.x}
                  y={textPoint.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={styles.segmentLabel}
                  transform={`rotate(${middleAngle}, ${textPoint.x}, ${textPoint.y})`}
                >
                  {abbreviateLabel(prize.name || prize.public_name)}
                </text>
              </g>
            );
          }) : (
            <circle cx="50" cy="50" r="48" fill="#071326" />
          )}

          <circle cx="50" cy="50" r="16" fill="url(#rouletteHubGlow)" className={styles.hubGlow} />
          <circle cx="50" cy="50" r="9" fill="#020817" className={styles.hubCore} />
          <text x="50" y="51.5" textAnchor="middle" dominantBaseline="middle" className={styles.hubText}>
            GO
          </text>
        </svg>
      </div>
      <div className={styles.wheelRing} aria-hidden="true" />
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

const createRequestId = () => {
  if (window.crypto?.randomUUID) {
    return `spin_req_${window.crypto.randomUUID()}`;
  }

  const values = new Uint32Array(4);
  window.crypto?.getRandomValues?.(values);
  return `spin_req_${Array.from(values).map((value) => value.toString(16)).join("")}_${Date.now()}`;
};

const createConfetti = () => {
  const colors = ["#00d4ff", "#38bdf8", "#facc15", "#22c55e", "#f97316", "#ffffff"];

  return Array.from({ length: CONFETTI_COUNT }, (_, index) => ({
    id: `${Date.now()}-${index}`,
    color: colors[index % colors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 520}ms`,
    duration: `${1700 + Math.random() * 1200}ms`,
    size: `${5 + Math.random() * 8}px`,
    drift: `${(Math.random() - 0.5) * 220}px`,
  }));
};

export default function RoulettePage() {
  const navigate = useNavigate();
  const prefersReducedMotion = usePrefersReducedMotion();
  const rotationRef = useRef(0);
  const resultTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const [activeTab, setActiveTab] = useState("wheel");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [state, setState] = useState(null);
  const [myPrizes, setMyPrizes] = useState([]);
  const [history, setHistory] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wheelTransition, setWheelTransition] = useState("");
  const [result, setResult] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(() => (
    localStorage.getItem(SOUND_STORAGE_KEY) !== "false"
  ));
  const [redeemingId, setRedeemingId] = useState(null);

  const user = state?.user || {};
  const balance = state?.balance || { available_spins: 0 };
  const activeCampaign = state?.campaign || null;
  const prizes = useMemo(() => state?.prizes || [], [state?.prizes]);
  const latestWinners = useMemo(() => state?.latest_winners || [], [state?.latest_winners]);
  const canSpin = Boolean(activeCampaign) && prizes.length > 0 && Number(balance.available_spins || 0) > 0 && !spinning;

  const sortedPrizes = useMemo(() => (
    [...prizes].sort((a, b) => Number(a.id) - Number(b.id))
  ), [prizes]);

  const selectedResultPrize = result?.prize || null;

  const playTone = useCallback((kind = "tick") => {
    if (!soundEnabled || typeof window === "undefined") return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const context = audioContextRef.current || new AudioContext();
    audioContextRef.current = context;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const isWin = kind === "win";
    const isJackpot = kind === "jackpot";

    oscillator.type = isJackpot ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(isJackpot ? 880 : isWin ? 660 : 420, now);
    oscillator.frequency.exponentialRampToValueAtTime(isJackpot ? 1320 : isWin ? 990 : 520, now + 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(isJackpot ? 0.08 : 0.045, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isJackpot ? 0.55 : 0.28));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + (isJackpot ? 0.58 : 0.32));
  }, [soundEnabled]);

  const loadRoulette = useCallback(async ({ silent = false } = {}) => {
    const token = getToken();

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      if (!silent) setLoading(true);
      setError("");

      const [stateRes, prizesRes, historyRes] = await Promise.all([
        api.get("/roulette/state", { headers: getHeaders() }),
        api.get("/roulette/my-prizes", { headers: getHeaders() }),
        api.get("/roulette/history", { headers: getHeaders() }),
      ]);

      setState(stateRes.data);
      setMyPrizes(Array.isArray(prizesRes.data) ? prizesRes.data : []);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
    } catch (err) {
      console.error("Erro ao carregar roleta:", err);

      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      setError(err.response?.data?.error || "Não foi possível carregar a Roleta de Prêmios.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [navigate]);

  const animateToPrize = useCallback((spinData) => new Promise((resolve) => {
    const prizeId = Number(spinData?.prize_id || spinData?.prizeId);
    const winnerIndex = sortedPrizes.findIndex((prize) => Number(prize.id) === prizeId);
    const duration = prefersReducedMotion ? REDUCED_SPIN_DURATION_MS : SPIN_DURATION_MS;

    if (winnerIndex < 0 || sortedPrizes.length === 0) {
      window.setTimeout(resolve, 160);
      return;
    }

    const segmentAngle = 360 / sortedPrizes.length;
    const winnerCenter = winnerIndex * segmentAngle + segmentAngle / 2;
    const currentRotation = rotationRef.current;
    const currentNormalized = ((currentRotation % 360) + 360) % 360;
    const targetNormalized = ((360 - winnerCenter) % 360 + 360) % 360;
    const delta = (targetNormalized - currentNormalized + 360) % 360;
    const turns = prefersReducedMotion ? 1 : 7;
    const finalRotation = currentRotation + turns * 360 + delta;

    setWheelTransition(`transform ${duration}ms cubic-bezier(0.08, 0.82, 0.18, 1)`);
    window.requestAnimationFrame(() => {
      rotationRef.current = finalRotation;
      setRotation(finalRotation);
    });
    resultTimeoutRef.current = window.setTimeout(resolve, duration + 140);
  }), [prefersReducedMotion, sortedPrizes]);

  const recoverPendingSpin = useCallback(async () => {
    const requestId = localStorage.getItem(PENDING_SPIN_STORAGE_KEY);

    if (!requestId) return;

    try {
      const { data } = await api.get(`/roulette/spins/request/${encodeURIComponent(requestId)}`, {
        headers: getHeaders(),
      });

      setResult(data);
      setConfetti(prefersReducedMotion ? [] : createConfetti());
      localStorage.removeItem(PENDING_SPIN_STORAGE_KEY);
      await loadRoulette({ silent: true });
    } catch (err) {
      if (err.response?.status === 404) {
        localStorage.removeItem(PENDING_SPIN_STORAGE_KEY);
      }
    }
  }, [loadRoulette, prefersReducedMotion]);

  useEffect(() => {
    loadRoulette();
  }, [loadRoulette]);

  useEffect(() => {
    if (!loading) {
      recoverPendingSpin();
    }
  }, [loading, recoverPendingSpin]);

  useEffect(() => () => {
    if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
    audioContextRef.current?.close?.();
  }, []);

  const finishSpin = async (spinData) => {
    await animateToPrize(spinData);
    setWheelTransition("");
    setResult(spinData);
    setConfetti(prefersReducedMotion ? [] : createConfetti());
    playTone(spinData?.prize?.is_jackpot ? "jackpot" : "win");
    localStorage.removeItem(PENDING_SPIN_STORAGE_KEY);
    await loadRoulette({ silent: true });
  };

  const spin = async () => {
    if (!canSpin) return;

    const requestId = createRequestId();

    try {
      setSpinning(true);
      setResult(null);
      setConfetti([]);
      setError("");
      localStorage.setItem(PENDING_SPIN_STORAGE_KEY, requestId);
      playTone("tick");

      const { data } = await api.post("/roulette/spin", {
        request_id: requestId,
      }, {
        headers: {
          ...getHeaders(),
          "Idempotency-Key": requestId,
        },
      });

      if (data?.balance) {
        setState((current) => current ? { ...current, balance: data.balance } : current);
      }

      await finishSpin(data);
    } catch (err) {
      console.error("Erro ao girar roleta:", err);

      if (!err.response) {
        try {
          const { data } = await api.get(`/roulette/spins/request/${encodeURIComponent(requestId)}`, {
            headers: getHeaders(),
          });
          await finishSpin(data);
          return;
        } catch (recoverErr) {
          console.error("Erro ao recuperar giro:", recoverErr);
        }
      }

      localStorage.removeItem(PENDING_SPIN_STORAGE_KEY);
      setError(err.response?.data?.error || "Não foi possível realizar o giro. Seu giro não foi consumido.");
    } finally {
      setSpinning(false);
    }
  };

  const requestRedemption = async (redemptionId = result?.redemption?.id) => {
    if (!redemptionId) return;

    try {
      setRedeemingId(redemptionId);
      const { data } = await api.post(`/roulette/redemptions/${redemptionId}/request`, {}, {
        headers: getHeaders(),
      });

      setMyPrizes((current) => current.map((item) => (
        Number(item.id) === Number(redemptionId) ? data : item
      )));
      setResult((current) => current ? {
        ...current,
        redemption: {
          ...(current.redemption || {}),
          id: redemptionId,
          status: data.status,
        },
      } : current);
      setActiveTab("prizes");
    } catch (err) {
      console.error("Erro ao solicitar resgate:", err);
      setError(err.response?.data?.error || "Não foi possível solicitar o resgate.");
    } finally {
      setRedeemingId(null);
    }
  };

  const toggleSound = () => {
    setSoundEnabled((current) => {
      const next = !current;
      localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      return next;
    });
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>Carregando Roleta de Prêmios...</div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {confetti.length > 0 && (
        <div className={styles.confettiLayer} aria-hidden="true">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className={styles.confetti}
              style={{
                "--confetti-color": piece.color,
                "--confetti-left": piece.left,
                "--confetti-delay": piece.delay,
                "--confetti-duration": piece.duration,
                "--confetti-size": piece.size,
                "--confetti-drift": piece.drift,
              }}
            />
          ))}
        </div>
      )}

      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigate("/chat")}>
          <ArrowLeft size={18} />
          Chat
        </button>

        <div className={styles.brand}>
          <span className={styles.brandMark}><Trophy size={22} /></span>
          <div>
            <strong>ROLETA DE PRÊMIOS</strong>
            <small>{activeCampaign?.name || "Sem campanha ativa"}</small>
          </div>
        </div>

        <nav className={styles.tabs} aria-label="Menu da roleta">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? styles.tabActive : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className={styles.userChip}>
          <button
            type="button"
            className={styles.soundButton}
            onClick={toggleSound}
            title={soundEnabled ? "Desativar som" : "Ativar som"}
            aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <div className={styles.avatar}>
            {user.avatar ? <img src={user.avatar} alt={user.nome || "Avatar"} /> : <span>{user.nome?.charAt(0)?.toUpperCase() || "U"}</span>}
          </div>
          <div>
            <strong>{user.nome || "Funcionário"}</strong>
            <small>{Number(balance.available_spins || 0)} giro{Number(balance.available_spins || 0) === 1 ? "" : "s"}</small>
          </div>
        </div>
      </header>

      {error && (
        <div className={styles.errorBox} role="alert">
          {error}
        </div>
      )}

      {activeTab === "wheel" && (
        <section className={styles.hero}>
          <div className={styles.copy}>
            <span className={styles.kicker}><Sparkles size={15} /> Boa sorte, {user.nome?.split(" ")[0] || "você"}</span>
            <h1>
              Você possui
              <strong>{Number(balance.available_spins || 0)} GIRO{Number(balance.available_spins || 0) === 1 ? "" : "S"} DISPONÍVE{Number(balance.available_spins || 0) === 1 ? "L" : "IS"}</strong>
            </h1>
          </div>

          <RouletteWheel
            prizes={sortedPrizes}
            rotation={rotation}
            transition={wheelTransition}
          />

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.spinButton}
              onClick={spin}
              disabled={!canSpin}
            >
              <RotateCw size={21} />
              {spinning ? "GIRANDO..." : "GIRAR AGORA"}
            </button>
            <span>
              {spinning
                ? "Resultado protegido pelo servidor"
                : canSpin
                  ? "1 giro será utilizado"
                  : !activeCampaign
                    ? "Nenhuma campanha ativa no momento"
                    : prizes.length === 0
                      ? "Todos os prêmios desta campanha foram distribuídos"
                      : "Você não possui giros disponíveis"}
            </span>
          </div>

          {latestWinners.length > 0 && (
            <aside className={styles.winnersStrip} aria-label="Últimos ganhadores">
              <strong>ÚLTIMOS GANHADORES</strong>
              <div className={styles.winnersTrack}>
                {latestWinners.concat(latestWinners).map((winner, index) => (
                  <span key={`${winner.spin_uid}-${index}`}>
                    <Medal size={15} />
                    {winner.user_name}
                    <em>{winner.prize_name}</em>
                  </span>
                ))}
              </div>
            </aside>
          )}
        </section>
      )}

      {activeTab === "prizes" && (
        <section className={styles.listPanel}>
          <div className={styles.sectionTitle}>
            <Gift size={20} />
            <h2>Meus Prêmios</h2>
          </div>

          {myPrizes.length > 0 ? (
            <div className={styles.prizeList}>
              {myPrizes.map((item) => (
                <article key={item.id} className={styles.prizeRow}>
                  <span className={styles.prizeBadge} style={{ "--prize-color": item.prize?.color || "#00d4ff" }}>
                    {item.prize?.is_jackpot ? <Crown size={18} /> : item.prize?.icon || <Gift size={18} />}
                  </span>
                  <div>
                    <strong>{item.prize?.result_name || item.prize?.name}</strong>
                    <small>Ganho em {formatDate(item.created_at)} · {item.campaign_name}</small>
                  </div>
                  <em>{normalizeStatus(item.status)}</em>
                  {["GANHO", "AGUARDANDO_RESGATE"].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => requestRedemption(item.id)}
                      disabled={redeemingId === item.id}
                    >
                      {redeemingId === item.id ? "Solicitando..." : "Resgatar"}
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>Nenhum prêmio ganho ainda.</div>
          )}
        </section>
      )}

      {activeTab === "history" && (
        <section className={styles.listPanel}>
          <div className={styles.sectionTitle}>
            <History size={20} />
            <h2>Histórico</h2>
          </div>

          {history.length > 0 ? (
            <div className={styles.historyTable}>
              <span>Data</span>
              <span>Campanha</span>
              <span>Prêmio</span>
              <span>Status</span>
              {history.map((item) => (
                <div key={item.spin_uid} className={styles.historyRow}>
                  <time>{formatDate(item.created_at)}</time>
                  <strong>{item.campaign?.name || "-"}</strong>
                  <span>{item.prize?.result_name || item.prize?.name || "-"}</span>
                  <em>{normalizeStatus(item.redemption_status || item.status)}</em>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>Nenhum giro registrado.</div>
          )}
        </section>
      )}

      {activeTab === "rules" && (
        <section className={styles.rulesPanel}>
          <div className={styles.sectionTitle}>
            <CircleHelp size={20} />
            <h2>Regras</h2>
          </div>
          <p>{activeCampaign?.rules || "As regras desta campanha ainda não foram cadastradas."}</p>
          {activeCampaign && (
            <div className={styles.ruleDates}>
              <span>Início: {formatDate(activeCampaign.starts_at)}</span>
              <span>Fim: {formatDate(activeCampaign.ends_at)}</span>
            </div>
          )}
          {user.perfil === "admin" && (
            <button type="button" className={styles.adminButton} onClick={() => navigate("/admin/roleta-premios")}>
              <ShieldCheck size={18} />
              Administração da roleta
            </button>
          )}
        </section>
      )}

      {selectedResultPrize && (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setResult(null)}>
          <section
            className={`${styles.resultModal} ${selectedResultPrize.is_jackpot ? styles.jackpotModal : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="roulette-result-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className={styles.resultIcon}>
              {selectedResultPrize.is_jackpot ? <Crown size={34} /> : <Trophy size={34} />}
            </span>
            <h2 id="roulette-result-title">PARABÉNS!</h2>
            <p>
              {selectedResultPrize.is_mystery
                ? "Você descobriu o prêmio misterioso:"
                : "Você ganhou:"}
            </p>
            <strong>{selectedResultPrize.result_name || selectedResultPrize.name}</strong>
            {selectedResultPrize.description && <small>{selectedResultPrize.description}</small>}

            <div className={styles.modalActions}>
              {result?.redemption?.id && ["GANHO", "AGUARDANDO_RESGATE"].includes(result.redemption.status || "AGUARDANDO_RESGATE") && (
                <button
                  type="button"
                  className={styles.primaryModalButton}
                  onClick={() => requestRedemption(result.redemption.id)}
                  disabled={redeemingId === result.redemption.id}
                >
                  {redeemingId === result.redemption.id ? "Solicitando..." : "RESGATAR PRÊMIO"}
                </button>
              )}
              <button
                type="button"
                className={styles.secondaryModalButton}
                onClick={() => {
                  setActiveTab("prizes");
                  setResult(null);
                }}
              >
                VER MEUS PRÊMIOS
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
