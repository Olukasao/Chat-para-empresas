import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { Server } from "socket.io";
import { createDashboardRelay, registerDashboardRelayRoute } from "../src/services/dashboardRelayService.js";

const listen = async (server) => {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${server.address().port}`;
};
const until = async (predicate) => {
    for (let i = 0; i < 150; i++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail("Resposta do relay não chegou");
};

test("relay mantém uma conexão local, exige autenticação e preserva dados ao desconectar", async () => {
    const upstream = createServer();
    const io = new Server(upstream);
    const relay = createDashboardRelay({ origin: await listen(upstream) });
    let connections = 0;
    let upstreamSocket;
    io.on("connection", socket => {
        upstreamSocket = socket;
        connections++;
        socket.emit("update", { total: 7, grupos: { OFFLINE: 7 }, atualizado: 1792590496708 });
        socket.emit("clientes", { total: 100, ativos: 90, atualizado: 1792590496708 });
    });
    const app = express();
    registerDashboardRelayRoute(app, (req, res, next) => req.headers.authorization === "Bearer fixture-only" ? next() : res.sendStatus(401), relay);
    const server = createServer(app);
    const url = await listen(server);
    try {
        const denied = await fetch(url + "/integrations/dashboard");
        assert.equal(denied.status, 401);
        assert.equal(connections, 0);
        const options = { headers: { Authorization: "Bearer fixture-only" } };
        await fetch(url + "/integrations/dashboard", options);
        await until(() => relay.read().customers?.total === 100);
        const response = await fetch(url + "/integrations/dashboard", options);
        const state = await response.json();
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(state.update.total, 7);
        assert.equal(state.customers.total, 100);
        assert.equal(state.update.atualizado, 1792590496708);
        assert.equal(connections, 1);
        assert.equal(upstreamSocket.conn.transport.name, "polling");
        upstreamSocket.emit("update", { grupos: [] });
        await new Promise(resolve => setTimeout(resolve, 40));
        assert.equal(relay.read().update.total, 7);
        upstreamSocket.conn.close();
        await until(() => !relay.read().connected);
        assert.equal(relay.read().update.total, 7);
        assert.equal(relay.read().customers.total, 100);
        await until(() => relay.read().connected && connections === 2);
        assert.equal(relay.read().update.total, 7);
    } finally {
        relay.stop();
        await new Promise(resolve => io.close(resolve));
        await new Promise(resolve => server.close(resolve));
    }
});
