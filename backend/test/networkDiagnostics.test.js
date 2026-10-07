import assert from "node:assert/strict";
import test from "node:test";
import { parsePingOutput } from "../src/services/networkPingService.js";
import { normalizeSgpCustomer } from "../src/services/sgpCustomerService.js";
import {
    extractSgpInternetServiceId,
    normalizeSgpQueueTraffic,
} from "../src/services/sgpWebTrafficService.js";
import { classifyDiagnosticResult } from "../src/services/networkDiagnosticsService.js";
import {
    validarCustomerId,
    validarPeriodoTrafego,
    validarTextoBuscaCliente,
} from "../src/validators/networkDiagnosticsValidator.js";

test("normaliza cliente retornado pelo SGP", () => {
    const customer = normalizeSgpCustomer({
        codigo_cliente: 123,
        codigo_contrato: 456,
        nome: "Joao da Silva",
        plano: "700 Mbps",
        login_pppoe: "joao.silva",
        ip_atual: "100.64.20.154",
        cidade: "Francisco Morato",
        status: "conectado",
        sinal_optico: "-19,4",
    });

    assert.equal(customer.id, "123");
    assert.equal(customer.contractId, "456");
    assert.equal(customer.status, "online");
    assert.equal(customer.planDownloadMbps, 700);
    assert.equal(customer.pppoeUsername, "joao.silva");
    assert.equal(customer.opticalSignalDbm, -19.4);
});

test("normaliza contrato SGP URA aninhado usando contrato como identificador", () => {
    const customer = normalizeSgpCustomer({
        cliente: {
            id: 123,
            nome: "Maria Souza",
            cpf_cnpj: "000.000.000-00",
        },
        contrato: {
            id_contrato: 987,
            status_contrato: "ativo",
        },
        servico: {
            login: "maria.souza",
            plano_nome: "500 Mega",
        },
        conexao: {
            ip_atual: "100.64.21.10",
        },
        onu: {
            sinal_optico: "-18,7",
        },
    }, { idPreference: "contract" });

    assert.equal(customer.id, "987");
    assert.equal(customer.customerId, "123");
    assert.equal(customer.contractId, "987");
    assert.equal(customer.name, "Maria Souza");
    assert.equal(customer.status, "online");
    assert.equal(customer.planDownloadMbps, 500);
    assert.equal(customer.pppoeUsername, "maria.souza");
    assert.equal(customer.ip, "100.64.21.10");
    assert.equal(customer.opticalSignalDbm, -18.7);
});

test("extrai servico de internet da aba contratos do SGP", () => {
    const html = `
        <div id="info_contrato_456_internet_777"></div>
        <a href="/admin/servicos/internet/777/">Editar Serviço</a>
        <div id="info_contrato_999_internet_888"></div>
    `;

    assert.equal(extractSgpInternetServiceId(html, "456"), "777");
    assert.equal(extractSgpInternetServiceId(html, "999"), "888");
});

test("normaliza trafego em tempo real do SGP web", () => {
    const traffic = normalizeSgpQueueTraffic([
        { name: "Tx", data: [224379] },
        { name: "Rx", data: [836178] },
        { name: "Raw", data: [23443768613, 1368098975] },
    ], {
        customer: {
            status: "online",
            pppoeUsername: "maria.souza",
        },
        serviceId: 777,
        raw: [23442932435, 1367874596],
    });

    assert.equal(traffic.available, true);
    assert.equal(traffic.source, "sgp-web");
    assert.equal(traffic.downloadMbps, 1.8);
    assert.equal(traffic.uploadMbps, 6.69);
    assert.equal(traffic.bytesReceived, 23443768613);
    assert.equal(traffic.bytesSent, 1368098975);
});

test("parseia perda, latencia e jitter do ping", () => {
    const result = parsePingOutput(`
5 packets transmitted, 5 received, 0% packet loss, time 4006ms
rtt min/avg/max/mdev = 7.121/8.253/10.110/1.014 ms
64 bytes from 100.64.20.154: icmp_seq=1 ttl=63 time=7.12 ms
64 bytes from 100.64.20.154: icmp_seq=2 ttl=63 time=9.12 ms
    `);

    assert.equal(result.sent, 5);
    assert.equal(result.received, 5);
    assert.equal(result.packetLossPercent, 0);
    assert.equal(result.avgMs, 8.25);
    assert.equal(result.jitterMs, 2);
});

test("classifica perda de pacotes acima do limite", () => {
    const result = classifyDiagnosticResult({
        customer: { planDownloadMbps: 700 },
        connectionStatus: "online",
        traffic: { available: true, downloadMbps: 20, uploadMbps: 4 },
        ping: { packetLossPercent: 5, avgMs: 8, jitterMs: 1 },
        remoteSpeedTest: { supported: false },
        hillstoneAvailable: true,
    });

    assert.equal(result.status, "packet_loss");
});

test("classifica uso elevado sem confundir com teste de capacidade", () => {
    const result = classifyDiagnosticResult({
        customer: { planDownloadMbps: 100, planUploadMbps: 50 },
        connectionStatus: "online",
        traffic: { available: true, downloadMbps: 91, uploadMbps: 10 },
        ping: { packetLossPercent: 0, avgMs: 8, jitterMs: 1 },
        remoteSpeedTest: { supported: false },
        hillstoneAvailable: true,
    });

    assert.equal(result.status, "high_usage");
    assert.equal(result.usagePercent, 91);
});

test("valida parametros seguros", () => {
    assert.equal(validarTextoBuscaCliente("  joao   silva "), "joao silva");
    assert.equal(validarCustomerId("cliente-123"), "cliente-123");
    assert.equal(validarPeriodoTrafego("1h"), "1h");
    assert.equal(validarPeriodoTrafego("7d"), "5m");
    assert.throws(() => validarCustomerId("../../etc/passwd"), /Cliente inválido/);
});
