// Download do aplicativo Acessa Workspace para as páginas web (aviso do novo app).
// Serve sempre o instalador da versão publicada no canal "stable" do servidor de atualizações.
import fs from 'fs';
import path from 'path';

const CANAL_STABLE = process.env.WORKSPACE_UPDATES_STABLE_DIR
    || '/home/noc/acessa-workspace-updates/public/windows/stable';
const NOME_ARQUIVO = /^AcessaWorkspace-\d+\.\d+\.\d+-Setup\.exe$/;

function lerVersaoPublicada() {
    const manifesto = fs.readFileSync(path.join(CANAL_STABLE, 'latest.yml'), 'utf8');
    const versao = /^version:\s*['"]?([\d.]+)['"]?\s*$/m.exec(manifesto)?.[1];
    const arquivo = /^path:\s*['"]?(\S+?)['"]?\s*$/m.exec(manifesto)?.[1];
    if (!versao || !arquivo || !NOME_ARQUIVO.test(arquivo)) throw new Error('Manifesto sem versão válida.');
    const caminho = path.join(CANAL_STABLE, arquivo);
    return { versao, arquivo, caminho, bytes: fs.statSync(caminho).size };
}

export function registrarAppDownload(app) {
    app.get('/app-download/versao', (_req, res) => {
        res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
        try {
            const { versao, bytes } = lerVersaoPublicada();
            res.json({ versao, tamanhoMb: Math.round(bytes / 1048576) });
        } catch {
            res.status(404).json({ erro: 'Aplicativo ainda não publicado.' });
        }
    });

    app.get('/app-download/AcessaWorkspace-Setup.exe', (_req, res) => {
        let info;
        try {
            info = lerVersaoPublicada();
        } catch {
            return res.status(404).json({ erro: 'Aplicativo ainda não publicado.' });
        }
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(info.bytes),
            'Content-Disposition': `attachment; filename="${info.arquivo}"`,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
        });
        const leitura = fs.createReadStream(info.caminho);
        leitura.on('error', () => res.destroy());
        leitura.pipe(res);
    });
}
