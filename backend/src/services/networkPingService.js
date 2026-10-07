import net from "net";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const DEFAULT_PING_COUNT = 5;
const DEFAULT_PING_TIMEOUT_SECONDS = 2;
const DEFAULT_COMMAND_TIMEOUT_MS = 16_000;

const arredondar = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return null;
    return Number(numero.toFixed(2));
};

export const parsePingOutput = (output = "") => {
    const texto = String(output || "");
    const statsMatch = texto.match(/(\d+)\s+packets transmitted,\s+(\d+)\s+(?:packets\s+)?received(?:,\s+\+\d+\s+errors)?(?:,\s+([\d.]+)%\s+packet loss)?/i);
    const lossMatch = texto.match(/([\d.]+)%\s+packet loss/i);
    const rttMatch = texto.match(/(?:rtt|round-trip)\s+min\/avg\/max\/(?:mdev|stddev)\s+=\s+([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)\s*ms/i);
    const samples = [...texto.matchAll(/time[=<]([\d.]+)\s*ms/gi)]
        .map((match) => Number(match[1]))
        .filter((valor) => Number.isFinite(valor));

    let jitterMs = null;

    if (samples.length > 1) {
        const variations = samples.slice(1).map((valor, index) => Math.abs(valor - samples[index]));
        jitterMs = arredondar(variations.reduce((total, valor) => total + valor, 0) / variations.length);
    } else if (rttMatch) {
        jitterMs = arredondar(rttMatch[4]);
    }

    return {
        sent: statsMatch ? Number(statsMatch[1]) : null,
        received: statsMatch ? Number(statsMatch[2]) : null,
        packetLossPercent: lossMatch ? arredondar(lossMatch[1]) : null,
        minMs: rttMatch ? arredondar(rttMatch[1]) : null,
        avgMs: rttMatch ? arredondar(rttMatch[2]) : null,
        maxMs: rttMatch ? arredondar(rttMatch[3]) : null,
        jitterMs,
        samples,
    };
};

const classifyPingStatus = ({ packetLossPercent, avgMs }) => {
    if (packetLossPercent === null) return "no_response";
    if (packetLossPercent >= 10) return "high_loss";
    if (packetLossPercent > 2) return "loss";
    if (avgMs !== null && avgMs > 120) return "high_latency";
    if (avgMs !== null && avgMs > 60) return "attention";
    return "normal";
};

export const runControlledPing = async (ip, { signal } = {}) => {
    const target = String(ip || "").trim();

    if (!net.isIP(target)) {
        return {
            available: false,
            status: "invalid_target",
            message: "Cliente sem IP válido para teste de ping.",
            target: null,
        };
    }

    const count = Math.min(10, Math.max(1, Number(process.env.NETWORK_DIAGNOSTIC_PING_COUNT || DEFAULT_PING_COUNT)));
    const timeoutSeconds = Math.min(5, Math.max(1, Number(process.env.NETWORK_DIAGNOSTIC_PING_TIMEOUT_SECONDS || DEFAULT_PING_TIMEOUT_SECONDS)));
    const commandTimeoutMs = Math.max(DEFAULT_COMMAND_TIMEOUT_MS, count * timeoutSeconds * 1500);
    let stdout = "";
    let stderr = "";
    let pingError = null;

    try {
        const result = await execFileAsync(
            "ping",
            ["-n", "-c", String(count), "-W", String(timeoutSeconds), target],
            {
                timeout: commandTimeoutMs,
                maxBuffer: 128 * 1024,
                signal,
                env: {
                    ...process.env,
                    LANG: "C",
                    LC_ALL: "C",
                },
            }
        );
        stdout = result.stdout || "";
        stderr = result.stderr || "";
    } catch (err) {
        pingError = err;
        stdout = err.stdout || "";
        stderr = err.stderr || "";
    }

    const parsed = parsePingOutput(`${stdout}\n${stderr}`);

    return {
        available: true,
        target,
        status: classifyPingStatus(parsed),
        ...parsed,
        errorMessage: pingError && parsed.received !== null && parsed.received > 0
            ? null
            : pingError?.message || null,
        testedAt: new Date().toISOString(),
        source: "backend-ping",
    };
};
