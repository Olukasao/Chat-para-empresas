// Dispara os alarmes: quando chega a hora de um lembrete, abre um alarme para o app e (se a pessoa quiser) avisa no chat.
import db from "../db/db.js";
import { entregar, garantirBot } from "./briefingService.js";
import { garantirSchemaLembretes, regraDaLinha } from "../Routes/lembretesRoutes.js";
import { agoraSaoPaulo } from "./lembretesIa.js";
import { proximaOcorrencia } from "./lembretesLogica.js";

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const COLUNAS = "id, empresa_id, usuario_id, texto, tipo, horarios, dias_semana, dia_mes, DATE_FORMAT(data_unica, '%Y-%m-%d') AS data_unica, avisar_chat, DATE_FORMAT(proximo_em, '%Y-%m-%d %H:%i:%s') AS proximo_em";

export async function dispararLembretesVencidos({ io, agora = new Date(), entregarFn = entregar } = {}) {
    await garantirSchemaLembretes();
    const ref = agoraSaoPaulo(agora);
    const limite = agoraSaoPaulo(new Date(agora.getTime() - UM_DIA_MS));
    const [vencidos] = await db.query(`SELECT ${COLUNAS} FROM lembretes WHERE ativo = 1 AND proximo_em IS NOT NULL AND proximo_em <= ? ORDER BY proximo_em ASC LIMIT 200`, [ref]);
    let disparados = 0;
    for (const l of vencidos) {
        const proximo = proximaOcorrencia(regraDaLinha(l), ref);
        // "Reivindica" o disparo comparando o horário que lemos: se outro processo já avançou, este não repete.
        const [r] = await db.query("UPDATE lembretes SET proximo_em = ?, ativo = ? WHERE id = ? AND proximo_em = ?", [proximo, proximo ? 1 : 0, l.id, l.proximo_em]);
        if (!r.affectedRows) continue;
        // Servidor parado há mais de um dia: não toca um alarme velho, só segue para a próxima vez.
        if (l.proximo_em < limite) continue;
        await db.query("INSERT INTO lembrete_disparos (lembrete_id, empresa_id, usuario_id, texto, disparou_em) VALUES (?, ?, ?, ?, ?)", [l.id, l.empresa_id, l.usuario_id, l.texto, l.proximo_em]);
        disparados += 1;
        if (l.avisar_chat) {
            try {
                const botId = await garantirBot(l.empresa_id);
                await entregarFn({ io, botId, para: l.usuario_id, texto: `⏰ Lembrete: ${l.texto}` });
            } catch (e) {
                console.error("[lembretes] aviso no chat falhou:", e?.message);
            }
        }
    }
    // Faxina: alarmes concluídos há mais de 30 dias e abertos há mais de 3 dias saem da fila.
    await db.query("DELETE FROM lembrete_disparos WHERE status = 'feito' AND disparou_em < ?", [agoraSaoPaulo(new Date(agora.getTime() - 30 * UM_DIA_MS))]);
    await db.query("UPDATE lembrete_disparos SET status = 'feito' WHERE status <> 'feito' AND disparou_em < ?", [agoraSaoPaulo(new Date(agora.getTime() - 3 * UM_DIA_MS))]);
    return disparados;
}

export function iniciarLembretes(io, { intervaloMs = 15_000 } = {}) {
    const tick = () => dispararLembretesVencidos({ io }).catch((e) => console.error("[lembretes] falhou:", e?.message));
    const timer = setInterval(tick, intervaloMs);
    timer.unref?.();
    return () => clearInterval(timer);
}
