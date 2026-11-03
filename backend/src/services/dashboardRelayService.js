import { io } from "socket.io-client";

// Uma conexão local ao dashboard. Nenhuma credencial SGP é necessária aqui.
export function createDashboardRelay({ origin = "http://127.0.0.1:5000" } = {}) {
    let socket;
    const state = { connected: false, update: null, customers: null, updateReceivedAt: null, customersReceivedAt: null, error: null };
    return {
        start() {
            if (socket) return;
            socket = io(origin, { transports: ["polling"], upgrade: false, reconnection: true, timeout: 10000 });
            socket.on("connect", () => { state.connected = true; state.error = null; });
            socket.on("disconnect", () => { state.connected = false; state.error = "Conexão local com o dashboard interrompida."; });
            socket.on("connect_error", () => { state.connected = false; state.error = "O servidor do Chat Interno não conseguiu alcançar o dashboard local."; });
            socket.on("update", (payload) => {
                if (!payload?.grupos || typeof payload.grupos !== "object" || Array.isArray(payload.grupos)) return;
                state.update = payload;
                state.updateReceivedAt = new Date().toISOString();
            });
            socket.on("clientes", (payload) => {
                if (!payload || typeof payload !== "object" || !Number.isFinite(Number(payload.total))) return;
                state.customers = payload;
                state.customersReceivedAt = new Date().toISOString();
            });
        },
        read() { return { ...state }; },
        stop() {
            socket?.removeAllListeners();
            socket?.disconnect();
            socket = undefined;
            state.connected = false;
        },
    };
}

export const dashboardRelay = createDashboardRelay();

export function registerDashboardRelayRoute(router, authenticate, relay = dashboardRelay) {
    router.get("/integrations/dashboard", authenticate, (_req, res) => {
        relay.start();
        res.set("Cache-Control", "no-store").json(relay.read());
    });
}
