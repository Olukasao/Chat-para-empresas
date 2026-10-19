import api from "../services/api";

// Mantém a identidade da agenda sincronizada com o login e logout do chat, sem outra tela de login.
let ultimoToken;
let ultimaSincronizacao = 0;
let emAndamento = false;
let sessaoToken = "";

function agendaOrigin(frame) {
    try {
        const url = new URL(frame.src, window.location.href);
        return url.hostname === window.location.hostname && url.protocol === "https:" && url.port === "8500"
            ? url.origin : null;
    } catch { return null; }
}

function avisarAgendas() {
    document.querySelectorAll("iframe").forEach(frame => {
        const origin = agendaOrigin(frame);
        if (origin) frame.contentWindow?.postMessage({ type: "agenda-chat-session", token: sessaoToken }, origin);
    });
}

async function sincronizarSessaoAgenda() {
    if (emAndamento) return;
    let token;
    try { token = localStorage.getItem("token") || ""; } catch { return; }
    if (token === ultimoToken && Date.now() - ultimaSincronizacao < 60000) return;
    emAndamento = true;
    try {
        if (token) {
            const { data } = await api.post("/integrations/agenda/session", {}, {
                headers: { Authorization: `Bearer ${token}` }, withCredentials: true
            });
            sessaoToken = data.sessaoToken || "";
        } else {
            await api.delete("/integrations/agenda/session", { withCredentials: true });
            sessaoToken = "";
        }
        ultimoToken = token;
        ultimaSincronizacao = Date.now();
        avisarAgendas();
    } catch (erro) {
        if (erro.response?.status === 401) {
            await api.delete("/integrations/agenda/session", { withCredentials: true }).catch(() => {});
            ultimoToken = token;
            ultimaSincronizacao = Date.now();
            sessaoToken = "";
            avisarAgendas();
        }
    } finally { emAndamento = false; }
}

window.addEventListener("storage", sincronizarSessaoAgenda);
window.addEventListener("focus", sincronizarSessaoAgenda);
window.addEventListener("message", async event => {
    if (event.data?.type !== "agenda-chat-session-request") return;
    const frame = [...document.querySelectorAll("iframe")].find(item => item.contentWindow === event.source);
    if (!frame || agendaOrigin(frame) !== event.origin) return;
    await sincronizarSessaoAgenda();
    event.source.postMessage({ type: "agenda-chat-session", token: sessaoToken }, event.origin);
});
setInterval(sincronizarSessaoAgenda, 2000);
void sincronizarSessaoAgenda();
