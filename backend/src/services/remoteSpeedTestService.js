const isTruthy = (valor) => ["1", "true", "yes", "sim", "on"].includes(String(valor || "").toLowerCase());

export const getRemoteSpeedTestAvailability = (customer = {}) => {
    const enabled = isTruthy(process.env.REMOTE_SPEED_TEST_ENABLED);
    const provider = process.env.REMOTE_SPEED_TEST_PROVIDER || "";

    if (!enabled || !provider) {
        return {
            available: false,
            supported: false,
            provider: provider || null,
            customerEquipment: customer.onuIdentifier || null,
            message: "Teste remoto indisponível para este equipamento.",
            tooltip: "Este teste exige suporte da ONU ou do roteador do cliente por ACS, TR-069, TR-143 ou tecnologia equivalente.",
        };
    }

    return {
        available: false,
        supported: false,
        provider,
        customerEquipment: customer.onuIdentifier || null,
        message: "Teste remoto indisponível para este equipamento.",
        tooltip: "Este teste exige suporte da ONU ou do roteador do cliente por ACS, TR-069, TR-143 ou tecnologia equivalente.",
    };
};

export const runRemoteSpeedTest = async (customer = {}) => {
    const availability = getRemoteSpeedTestAvailability(customer);

    if (!availability.supported) {
        return {
            ...availability,
            downloadMbps: null,
            uploadMbps: null,
            pingMs: null,
            jitterMs: null,
            packetLossPercent: null,
            durationSeconds: null,
            server: null,
            testedAt: null,
        };
    }

    return {
        ...availability,
        supported: false,
        available: false,
        message: "Teste remoto indisponível para este equipamento.",
        downloadMbps: null,
        uploadMbps: null,
        pingMs: null,
        jitterMs: null,
        packetLossPercent: null,
        durationSeconds: null,
        server: null,
        testedAt: null,
    };
};
