/*
 * Aviso do novo app da intranet (Acessa Workspace) para as p\u00e1ginas web.
 * Um arquivo s\u00f3, sem depend\u00eancias: o CSS fica dentro de um Shadow DOM e n\u00e3o mexe na p\u00e1gina.
 * Uso: <script src="/aviso-app-intranet.js" defer></script>
 *      data-origin="http://192.168.1.133:8600"  (opcional: de onde baixar, quando a p\u00e1gina n\u00e3o for do mesmo servidor)
 * N\u00e3o aparece dentro do pr\u00f3prio aplicativo (navegador embutido do Electron).
 */
(function () {
  'use strict';

  if (/Electron\//.test(navigator.userAgent) || window.desktop) return;
  if (window.__avisoAppIntranet) return;
  window.__avisoAppIntranet = true;

  var script = document.currentScript;
  var origem = ((script && script.getAttribute('data-origin')) || '').replace(/\/+$/, '');
  var LINK = origem + '/app-download/AcessaWorkspace-Setup.exe';
  var CHAVE = 'acessa:aviso-app-intranet:v5';
  var ADIAR_MS = 60 * 60 * 1000; // "Agora n\u00e3o" e o X: volta em 1 hora
  var BAIXOU_MS = 30 * 24 * 60 * 60 * 1000; // depois de baixar: volta em 30 dias

  function lerEstado() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; }
  }
  function salvarEstado(ms) {
    try { localStorage.setItem(CHAVE, JSON.stringify({ ate: Date.now() + ms })); } catch (e) { /* sem storage: volta na pr\u00f3xima visita */ }
  }
  var estado = lerEstado();
  var avisoAdiado = function () { var e = lerEstado(); return Boolean(e && e.ate > Date.now() && location.search.indexOf('aviso=1') < 0); };

  var CSS = '\
:host{all:initial}\
*{box-sizing:border-box;margin:0}\
.fundo{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;\
background:radial-gradient(60% 60% at 50% 40%,rgba(47,107,255,.28),rgba(3,7,22,.78));\
-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);\
font-family:"Manrope","Segoe UI",system-ui,-apple-system,sans-serif;opacity:0;transition:opacity .35s ease}\
.fundo.on{opacity:1}\
.fundo:focus{outline:0}\
.cartao{position:relative;width:min(880px,100%);max-height:calc(100vh - 40px);overflow:auto;border-radius:26px;color:#eef3ff;\
background:radial-gradient(70% 90% at 100% 0%,rgba(47,107,255,.34),transparent 60%),radial-gradient(50% 70% at 0% 100%,rgba(58,214,255,.14),transparent 70%),linear-gradient(160deg,#0d1a3d 0%,#050b1f 100%);\
box-shadow:0 40px 90px -30px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.1);\
display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);\
transform:translateY(18px) scale(.97);transition:transform .55s cubic-bezier(.16,1,.3,1)}\
.fundo.on .cartao{transform:none}\
.fibra{position:absolute;left:0;right:0;top:0;height:3px;overflow:hidden;border-radius:26px 26px 0 0}\
.fibra::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,#2f6bff 30%,#3ad6ff 60%,transparent)}\
.fibra::after{content:"";position:absolute;top:0;bottom:0;width:22%;background:linear-gradient(90deg,transparent,#fff,transparent);animation:luz 3.2s ease-in-out infinite}\
@keyframes luz{from{left:-25%}to{left:105%}}\
.fechar{position:absolute;top:14px;right:14px;z-index:2;display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:50%;\
background:rgba(255,255,255,.08);color:#dbe6ff;cursor:pointer;transition:background .2s,transform .2s}\
.fechar:hover{background:rgba(255,255,255,.18);transform:rotate(90deg)}\
.fechar:focus-visible,.baixar:focus-visible,.depois:focus-visible{outline:2px solid #3ad6ff;outline-offset:3px}\
.texto{padding:42px 20px 34px 40px;display:flex;flex-direction:column;align-items:flex-start;gap:14px}\
.novo{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 12px;border-radius:999px;font-size:12.5px;font-weight:700;color:#8ae8ff;\
background:rgba(58,214,255,.12);box-shadow:inset 0 0 0 1px rgba(58,214,255,.3)}\
.novo i{width:7px;height:7px;border-radius:50%;background:#3ad6ff;box-shadow:0 0 0 3px rgba(58,214,255,.25)}\
h2{font-family:"Sora","Manrope","Segoe UI",system-ui,sans-serif;font-size:clamp(27px,3.4vw,38px);line-height:1.08;letter-spacing:-.035em;font-weight:600;color:#fff;text-wrap:balance}\
.sub{font-size:15.5px;line-height:1.55;color:rgba(226,235,255,.78);max-width:42ch}\
.sub b{color:#fff;font-weight:700}\
ul{list-style:none;padding:0;display:grid;gap:9px;margin-top:4px}\
li{display:flex;align-items:flex-start;gap:10px;font-size:14px;line-height:1.4;color:rgba(226,235,255,.86)}\
li svg{flex:none;margin-top:1px;color:#3ad6ff}\
.acoes{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;margin-top:10px}\
.baixar{display:inline-flex;align-items:center;gap:10px;height:50px;padding:0 24px;border-radius:14px;border:0;cursor:pointer;text-decoration:none;\
font:700 15.5px "Manrope","Segoe UI",system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#2f6bff,#1fb6ff);\
box-shadow:0 14px 28px -12px rgba(47,107,255,.95),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .2s,box-shadow .2s}\
.baixar:hover{transform:translateY(-2px);box-shadow:0 18px 32px -12px rgba(47,107,255,1),inset 0 1px 0 rgba(255,255,255,.4)}\
.baixar:active{transform:translateY(0)}\
.depois{border:0;background:none;color:rgba(226,235,255,.66);font:600 13.5px "Manrope","Segoe UI",system-ui,sans-serif;cursor:pointer;padding:8px 4px;text-decoration:underline;text-underline-offset:3px}\
.depois:hover{color:#fff}\
.meta{font-size:12.5px;color:rgba(226,235,255,.55);min-height:1.2em}\
.vitrine{position:relative;display:grid;place-items:center;padding:38px 36px 34px 8px;min-width:0}\
.janela{position:relative;width:100%;border-radius:16px;overflow:hidden;background:#0a1430;transform:perspective(1100px) rotateY(-9deg) rotateX(3deg);\
box-shadow:0 30px 50px -22px rgba(0,0,0,.9),0 0 0 1px rgba(143,178,255,.18),0 0 60px -10px rgba(47,107,255,.5);transition:transform .6s cubic-bezier(.16,1,.3,1)}\
.cartao:hover .janela{transform:perspective(1100px) rotateY(-3deg) rotateX(1deg)}\
.barra{display:flex;gap:5px;padding:9px 12px;background:#070e24}\
.barra span{width:8px;height:8px;border-radius:50%;background:#2a3858}\
.corpo{display:grid;grid-template-columns:34px 1fr;min-height:236px}\
.menu{display:grid;align-content:start;justify-items:center;gap:9px;padding:12px 0;background:#060d24}\
.menu span{width:16px;height:16px;border-radius:5px;background:#17254a}\
.menu span:first-child{background:#2f6bff}\
.tela{padding:14px 14px 12px;display:grid;align-content:start;gap:9px}\
.ola{font:600 15px "Sora","Manrope",sans-serif;color:#fff;letter-spacing:-.02em}\
.ia{display:grid;gap:5px;padding:9px 10px;border-radius:10px;background:rgba(47,107,255,.14);box-shadow:inset 0 0 0 1px rgba(79,134,255,.28)}\
.ia em{display:flex;align-items:center;gap:5px;font-style:normal;font-size:10px;font-weight:700;color:#8ae8ff}\
.ia span{display:block;height:6px;border-radius:3px;background:linear-gradient(90deg,rgba(143,178,255,.2),rgba(143,178,255,.5),rgba(143,178,255,.2));background-size:200% 100%;animation:brilho 2.4s linear infinite}\
@keyframes brilho{from{background-position:200% 0}to{background-position:-200% 0}}\
.ia span:nth-child(2){width:92%}.ia span:nth-child(3){width:78%}.ia span:nth-child(4){width:54%}\
.pilulas{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}\
.pilulas b{display:flex;align-items:center;gap:5px;padding:7px 6px;border-radius:9px;background:rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.12);font-size:8.5px;font-weight:700;color:#dbe6ff;white-space:nowrap;overflow:hidden}\
.pilulas b::before{content:"";flex:none;width:12px;height:12px;border-radius:4px;background:linear-gradient(135deg,#2f6bff,#3ad6ff)}\
.selo{position:absolute;right:20px;bottom:18px;display:flex;align-items:center;gap:8px;padding:9px 14px 9px 10px;border-radius:14px;background:rgba(10,20,51,.92);\
box-shadow:0 14px 30px -12px rgba(0,0,0,.8),inset 0 0 0 1px rgba(143,178,255,.22);font-size:12px;font-weight:700;color:#fff;animation:flutua 5s ease-in-out infinite}\
.selo svg{color:#3ad6ff}\
@keyframes flutua{50%{transform:translateY(-6px)}}\
@media (max-width:760px){\
.cartao{grid-template-columns:1fr}\
.texto{padding:44px 24px 8px}\
.vitrine{padding:8px 24px 28px}\
.janela{transform:none}\
.selo{right:34px}\
}\
@media (prefers-reduced-motion:reduce){\
.fundo,.cartao,.janela{transition:none}.fibra::after,.ia span,.selo{animation:none}\
}';

  var ICON_CHECK = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var ICON_SPARK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
  var ICON_DOWN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>';
  var ICON_X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  var HTML = '\
<div class="fundo" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="titulo">\
  <div class="cartao">\
    <div class="fibra" aria-hidden="true"></div>\
    <button class="fechar" type="button" aria-label="Fechar aviso">' + ICON_X + '</button>\
    <div class="texto">\
      <span class="novo"><i></i>Novo app da intranet</span>\
      <h2 id="titulo">Conhe\u00e7a o novo Acessa Workspace</h2>\
      <p class="sub">O app da AcessaNet agora vem com <b>Intelig\u00eancia Artificial integrada</b>: <b>pergunte o que quiser</b>, <b>mande uma imagem</b> ou um print para ela analisar e receba todo dia o resumo do seu dia, com as filas, a agenda e os avisos.</p>\
      <ul>\
        <li>' + ICON_CHECK + 'IA para perguntas e imagens, e o resumo do dia que aparece sozinho</li>\
        <li>' + ICON_CHECK + 'Chat interno, agenda t\u00e9cnica completa (vers\u00e3o web) e dashboard num s\u00f3 lugar</li>\
        <li>' + ICON_CHECK + 'SGP, OLT, Zabbix e Grafana no navegador do app</li>\
        <li>' + ICON_CHECK + 'Lembretes com alarme: diga em uma frase o que quer lembrar e quando, e a IA monta o alarme que toca no app</li>\
        <li>' + ICON_CHECK + 'Telefone no app: digite ou cole o n\u00famero e o MicroSIP j\u00e1 disca</li>\
        <li>' + ICON_CHECK + 'Atualiza\u00e7\u00f5es mais constantes: o app recebe melhorias e corre\u00e7\u00f5es com mais frequ\u00eancia que as p\u00e1ginas web, e se atualiza sozinho</li>\
      </ul>\
      <div class="acoes">\
        <a class="baixar" href="' + LINK + '" download>' + ICON_DOWN + 'Baixar o app</a>\
        <button class="depois" type="button">Agora n\u00e3o</button>\
      </div>\
      <p class="meta" id="meta">Para Windows</p>\
    </div>\
    <div class="vitrine" aria-hidden="true">\
      <div class="janela">\
        <div class="barra"><span></span><span></span><span></span></div>\
        <div class="corpo">\
          <div class="menu"><span></span><span></span><span></span><span></span><span></span></div>\
          <div class="tela">\
            <div class="ola">Bom dia, equipe</div>\
            <div class="ia"><em>' + ICON_SPARK + 'Resumo de hoje</em><span></span><span></span><span></span><span></span></div>\
            <div class="pilulas"><b>Chat interno</b><b>Agenda</b><b>Navegador</b><b>IA</b><b>Ferramentas</b><b>Dashboard</b></div>\
          </div>\
        </div>\
      </div>\
      <div class="selo">' + ICON_SPARK + 'IA integrada</div>\
    </div>\
  </div>\
</div>';

  function montar(info) {
    var anfitriao = document.createElement('div');
    anfitriao.id = 'aviso-app-intranet';
    var raiz = anfitriao.attachShadow({ mode: 'open' });
    raiz.innerHTML = '<style>' + CSS + '</style>' + HTML;
    document.body.appendChild(anfitriao);

    var fundo = raiz.querySelector('.fundo');
    var fechar = raiz.querySelector('.fechar');
    var depois = raiz.querySelector('.depois');
    var baixar = raiz.querySelector('.baixar');
    var meta = raiz.querySelector('#meta');
    var focoAnterior = document.activeElement;

    function encerrar(ms) {
      salvarEstado(ms);
      if (ms === ADIAR_MS) setTimeout(function () { window.__avisoAppIntranet = false; iniciar(); }, ms + 1000);
      fundo.classList.remove('on');
      document.removeEventListener('keydown', aoTeclar, true);
      setTimeout(function () {
        anfitriao.remove();
        if (focoAnterior && focoAnterior.focus) { try { focoAnterior.focus(); } catch (e) { /* elemento saiu da p\u00e1gina */ } }
      }, 360);
    }
    function aoTeclar(e) {
      if (e.key === 'Escape') { e.stopPropagation(); encerrar(ADIAR_MS); return; }
      if (e.key !== 'Tab') return;
      var itens = [fechar, baixar, depois];
      var atual = itens.indexOf(raiz.activeElement);
      e.preventDefault();
      itens[(atual + (e.shiftKey ? itens.length - 1 : 1)) % itens.length].focus();
    }
    fechar.addEventListener('click', function () { encerrar(ADIAR_MS); });
    depois.addEventListener('click', function () { encerrar(ADIAR_MS); });
    fundo.addEventListener('mousedown', function (e) { if (e.target === fundo) encerrar(ADIAR_MS); });
    baixar.addEventListener('click', function () { salvarEstado(BAIXOU_MS); setTimeout(function () { encerrar(BAIXOU_MS); }, 600); });
    document.addEventListener('keydown', aoTeclar, true);

    meta.textContent = 'Vers\u00e3o ' + info.versao + ' \u00b7 Windows \u00b7 ' + info.tamanhoMb + ' MB';
    requestAnimationFrame(function () { fundo.classList.add('on'); fundo.focus({ preventScroll: true }); });
  }

  // O aviso s\u00f3 aparece quando o download est\u00e1 de fato dispon\u00edvel neste servidor:
  // sem resposta v\u00e1lida da vers\u00e3o publicada, a p\u00e1gina fica como sempre foi.

  // Botão fixo "Baixe o novo app": fica sempre na página, mesmo depois de o aviso ser fechado.
  var CSS_BOTAO = ':host{all:initial}*{box-sizing:border-box;margin:0}\
.pilula{position:fixed;left:18px;bottom:18px;z-index:2147482000;display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 18px 0 14px;border-radius:999px;\
font:700 14px "Manrope","Segoe UI",system-ui,-apple-system,sans-serif;color:#fff;text-decoration:none;letter-spacing:.005em;\
background:linear-gradient(135deg,#2f6bff,#1fb6ff);box-shadow:0 14px 28px -10px rgba(47,107,255,.95),inset 0 1px 0 rgba(255,255,255,.4);\
transition:transform .2s cubic-bezier(.16,1,.3,1),box-shadow .2s}\
.pilula:hover{transform:translateY(-2px);box-shadow:0 18px 32px -10px rgba(47,107,255,1),inset 0 1px 0 rgba(255,255,255,.45)}\
.pilula:active{transform:translateY(0)}\
.pilula:focus-visible{outline:2px solid #fff;outline-offset:3px}\
.pilula::after{content:"";position:absolute;inset:-4px;border-radius:999px;border:2px solid rgba(58,214,255,.55);animation:anel 2.8s ease-out infinite;pointer-events:none}\
@keyframes anel{0%{transform:scale(.96);opacity:.9}70%,100%{transform:scale(1.14);opacity:0}}\
@media (max-width:560px){.pilula{left:12px;bottom:12px;height:40px;font-size:13px}}\
@media (prefers-reduced-motion:reduce){.pilula::after{animation:none;display:none}.pilula{transition:none}}';

  function montarBotao() {
    if (document.getElementById('botao-app-intranet')) return;
    var anfitriao = document.createElement('div');
    anfitriao.id = 'botao-app-intranet';
    var raiz = anfitriao.attachShadow({ mode: 'open' });
    raiz.innerHTML = '<style>' + CSS_BOTAO + '</style><a class="pilula" href="' + LINK + '" download title="Baixar o aplicativo Acessa Workspace para Windows">' + ICON_DOWN + 'Baixe o novo app</a>';
    raiz.querySelector('a').addEventListener('click', function () { salvarEstado(BAIXOU_MS); });
    document.body.appendChild(anfitriao);
  }

  function iniciar() {
    fetch(origem + '/app-download/versao', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (!v || !v.versao) return;
        montarBotao();
        if (!avisoAdiado()) setTimeout(function () { if (!document.getElementById('aviso-app-intranet')) montar(v); }, 700);
      })
      .catch(function () { /* sem aviso */ });
  }
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
