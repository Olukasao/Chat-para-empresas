import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import {
  CHAT_APPEARANCE_DEFAULTS,
  CHAT_APPEARANCE_THEME_PRESETS,
  CHAT_APPEARANCE_WALLPAPER_PRESETS,
  MESSAGE_RADIUS_PRESETS,
  buildChatAppearanceCssVars,
  contrastRatio,
} from './chatAppearance';

const SECTIONS = [
  { id: 'tema', label: 'Tema' },
  { id: 'wallpaper', label: 'Papel de parede' },
  { id: 'cores', label: 'Cores' },
  { id: 'mensagens', label: 'Mensagens e fonte' },
  { id: 'densidade', label: 'Densidade' },
  { id: 'extras', label: 'Extras' },
];

const COLOR_FIELDS = [
  { key: 'accentColor', label: 'Cor de destaque (accent)' },
  { key: 'ownMessageColor', label: 'Minhas mensagens' },
  { key: 'receivedMessageColor', label: 'Mensagens recebidas' },
  { key: 'textColor', label: 'Texto' },
  { key: 'secondaryTextColor', label: 'Texto secundário' },
  { key: 'linkColor', label: 'Links' },
];

function ColorInput({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '6px 0' }}>
      <span style={{ fontSize: '13px' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '32px', height: '28px', border: 'none', background: 'none', cursor: 'pointer' }}
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} title="Limpar" style={{ fontSize: '11px', opacity: 0.7 }}>
            ×
          </button>
        )}
      </span>
    </label>
  );
}

export default function ChatAppearanceModal({ open, onClose, token, conversationContext = null, onSaved }) {
  const [activeSection, setActiveSection] = useState('tema');
  const [draft, setDraft] = useState(CHAT_APPEARANCE_DEFAULTS);
  const [original, setOriginal] = useState(CHAT_APPEARANCE_DEFAULTS);
  const [applyScope, setApplyScope] = useState('global');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    let cancelado = false;
    setLoading(true);
    setErro('');
    setApplyScope('global');

    api.get('/chat/appearance', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        if (cancelado) return;
        setDraft(data?.preferences || CHAT_APPEARANCE_DEFAULTS);
        setOriginal(data?.preferences || CHAT_APPEARANCE_DEFAULTS);
      })
      .catch((err) => {
        console.error('Erro ao carregar personalização:', err);
        if (!cancelado) setErro('Não foi possível carregar suas preferências.');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => { cancelado = true; };
  }, [open, token]);

  const previewCssVars = useMemo(() => buildChatAppearanceCssVars(draft), [draft]);

  const patch = (fields) => {
    setDraft((atual) => ({ ...atual, ...fields, theme: fields.theme || 'custom' }));
  };

  const aplicarTemaPreset = (preset) => {
    if (!preset.colors) {
      setDraft((atual) => ({
        ...atual,
        theme: 'default',
        accentColor: null, backgroundColor: null, panelColor: null,
        ownMessageColor: null, receivedMessageColor: null,
        textColor: null, secondaryTextColor: null, linkColor: null,
      }));
      return;
    }

    setDraft((atual) => ({ ...atual, theme: preset.id, ...preset.colors }));
  };

  const handleWallpaperUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setErro('');

    try {
      const formData = new FormData();
      formData.append('wallpaper', file);

      const { data } = await api.post('/chat/appearance/wallpaper', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });

      patch({ wallpaperType: 'upload', wallpaperUrl: data.url });
    } catch (err) {
      console.error('Erro ao enviar wallpaper:', err);
      setErro(err.response?.data?.error || 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleSalvar = async () => {
    setSaving(true);
    setErro('');

    try {
      if (applyScope === 'conversation' && conversationContext) {
        await api.put(
          `/chat/appearance/conversations/${conversationContext.tipo}/${conversationContext.referenciaId}`,
          {
            wallpaperType: draft.wallpaperType,
            wallpaperUrl: draft.wallpaperUrl,
            wallpaperColor: draft.wallpaperColor,
            wallpaperColor2: draft.wallpaperColor2,
            wallpaperAngle: draft.wallpaperAngle,
            wallpaperMode: draft.wallpaperMode,
            backgroundColor: draft.backgroundColor,
            ownMessageColor: draft.ownMessageColor,
            receivedMessageColor: draft.receivedMessageColor,
            accentColor: draft.accentColor,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        onSaved?.({ scope: 'conversation', conversationContext, preferences: draft });
        onClose();
        return;
      }

      const { data } = await api.put('/chat/appearance', draft, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOriginal(data.preferences);
      onSaved?.({ scope: 'global', preferences: data.preferences });
      onClose();
    } catch (err) {
      console.error('Erro ao salvar personalização:', err);
      setErro('Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestaurarPadrao = async () => {
    setDraft(CHAT_APPEARANCE_DEFAULTS);
  };

  const handleCancelar = () => {
    setDraft(original);
    onClose();
  };

  if (!open) return null;

  const contraste = draft.ownMessageColor && draft.textColor
    ? contrastRatio(draft.ownMessageColor, draft.textColor)
    : null;
  const contrasteBaixo = contraste !== null && contraste < 3;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 80, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '20px',
        background: 'rgba(2, 8, 23, 0.76)',
      }}
      onClick={handleCancelar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(920px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          background: 'var(--bg-primary, #071120)', color: 'var(--text-primary, #e5e7eb)',
          borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-color, #0b2a44)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color, #0b2a44)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Personalização do Chat</h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', opacity: 0.7 }}>Só afeta a sua própria conta.</p>
          </div>
          <button type="button" onClick={handleCancelar} style={{ fontSize: '20px', lineHeight: 1, opacity: 0.7 }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>
        ) : (
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <div style={{ width: '190px', flexShrink: 0, borderRight: '1px solid var(--border-color, #0b2a44)', padding: '12px 0', overflowY: 'auto' }}>
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '10px 18px',
                    background: activeSection === section.id ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    borderLeft: activeSection === section.id ? '3px solid #38bdf8' : '3px solid transparent',
                    color: 'inherit', fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  {section.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, padding: '18px 22px', overflowY: 'auto' }}>
              {erro && <div style={{ color: '#f87171', marginBottom: '12px', fontSize: '13px' }}>{erro}</div>}

              {activeSection === 'tema' && (
                <div>
                  <h3 style={{ marginTop: 0, fontSize: '15px' }}>Temas prontos</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
                    {CHAT_APPEARANCE_THEME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => aplicarTemaPreset(preset)}
                        style={{
                          padding: '10px', borderRadius: '10px', textAlign: 'center', fontSize: '12px', cursor: 'pointer',
                          border: draft.theme === preset.id ? '2px solid #38bdf8' : '1px solid var(--border-color, #0b2a44)',
                          background: preset.colors?.backgroundColor || 'var(--bg-secondary, #081527)',
                          color: preset.colors?.textColor || 'inherit',
                        }}
                      >
                        <div
                          style={{
                            width: '100%', height: '28px', borderRadius: '6px', marginBottom: '6px',
                            background: preset.colors?.ownMessageColor || 'var(--message-sent, #0F4C81)',
                          }}
                        />
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'wallpaper' && (
                <div>
                  <h3 style={{ marginTop: 0, fontSize: '15px' }}>Papel de parede</h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {['none', 'preset', 'upload', 'color', 'gradient'].map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => patch({ wallpaperType: tipo })}
                        style={{
                          padding: '6px 12px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer',
                          border: draft.wallpaperType === tipo ? '1px solid #38bdf8' : '1px solid var(--border-color, #0b2a44)',
                          background: draft.wallpaperType === tipo ? 'rgba(56,189,248,0.15)' : 'transparent',
                          color: 'inherit',
                        }}
                      >
                        {{ none: 'Nenhum', preset: 'Predefinido', upload: 'Minha imagem', color: 'Cor sólida', gradient: 'Gradiente' }[tipo]}
                      </button>
                    ))}
                  </div>

                  {draft.wallpaperType === 'preset' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                      {CHAT_APPEARANCE_WALLPAPER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => patch({ wallpaperUrl: preset.id })}
                          style={{
                            height: '54px', borderRadius: '8px', backgroundImage: preset.css, cursor: 'pointer',
                            border: draft.wallpaperUrl === preset.id ? '2px solid #ffffff' : '1px solid var(--border-color, #0b2a44)',
                          }}
                          title={preset.label}
                        />
                      ))}
                    </div>
                  )}

                  {draft.wallpaperType === 'upload' && (
                    <div style={{ marginBottom: '14px' }}>
                      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleWallpaperUpload} />
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? 'Enviando...' : 'Escolher imagem'}
                      </button>
                      {draft.wallpaperUrl && (
                        <div style={{ marginTop: '10px', width: '160px', height: '90px', backgroundImage: `url("${draft.wallpaperUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '8px' }} />
                      )}
                    </div>
                  )}

                  {draft.wallpaperType === 'color' && (
                    <ColorInput label="Cor do fundo" value={draft.wallpaperColor} onChange={(v) => patch({ wallpaperColor: v })} />
                  )}

                  {draft.wallpaperType === 'gradient' && (
                    <div>
                      <ColorInput label="Cor 1" value={draft.wallpaperColor} onChange={(v) => patch({ wallpaperColor: v })} />
                      <ColorInput label="Cor 2" value={draft.wallpaperColor2} onChange={(v) => patch({ wallpaperColor2: v })} />
                      <label style={{ display: 'block', fontSize: '13px', marginTop: '8px' }}>
                        Ângulo: {draft.wallpaperAngle}°
                        <input type="range" min="0" max="360" value={draft.wallpaperAngle} onChange={(e) => patch({ wallpaperAngle: Number(e.target.value) })} style={{ width: '100%' }} />
                      </label>
                    </div>
                  )}

                  {draft.wallpaperType !== 'none' && (
                    <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
                      <label style={{ fontSize: '13px' }}>
                        Intensidade: {draft.wallpaperIntensity}%
                        <input type="range" min="0" max="100" value={draft.wallpaperIntensity} onChange={(e) => patch({ wallpaperIntensity: Number(e.target.value) })} style={{ width: '100%' }} />
                      </label>
                      <label style={{ fontSize: '13px' }}>
                        Blur: {draft.wallpaperBlur}px
                        <input type="range" min="0" max="20" value={draft.wallpaperBlur} onChange={(e) => patch({ wallpaperBlur: Number(e.target.value) })} style={{ width: '100%' }} />
                      </label>
                      {(draft.wallpaperType === 'upload' || draft.wallpaperType === 'preset') && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {['cover', 'contain', 'repeat'].map((modo) => (
                            <button
                              key={modo}
                              type="button"
                              onClick={() => patch({ wallpaperMode: modo })}
                              style={{
                                padding: '5px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                                border: draft.wallpaperMode === modo ? '1px solid #38bdf8' : '1px solid var(--border-color, #0b2a44)',
                                background: draft.wallpaperMode === modo ? 'rgba(56,189,248,0.15)' : 'transparent', color: 'inherit',
                              }}
                            >
                              {{ cover: 'Preencher', contain: 'Ajustar', repeat: 'Repetir' }[modo]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {conversationContext && (
                    <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-color, #0b2a44)' }}>
                      <p style={{ fontSize: '13px', marginBottom: '8px' }}>Aplicar wallpaper e cores em:</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setApplyScope('global')}
                          style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '12px', border: applyScope === 'global' ? '1px solid #38bdf8' : '1px solid var(--border-color, #0b2a44)', background: applyScope === 'global' ? 'rgba(56,189,248,0.15)' : 'transparent', color: 'inherit', cursor: 'pointer' }}
                        >
                          Todas as conversas
                        </button>
                        <button
                          type="button"
                          onClick={() => setApplyScope('conversation')}
                          style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '12px', border: applyScope === 'conversation' ? '1px solid #38bdf8' : '1px solid var(--border-color, #0b2a44)', background: applyScope === 'conversation' ? 'rgba(56,189,248,0.15)' : 'transparent', color: 'inherit', cursor: 'pointer' }}
                        >
                          Somente {conversationContext.label || 'esta conversa'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'cores' && (
                <div>
                  <h3 style={{ marginTop: 0, fontSize: '15px' }}>Cores</h3>
                  {COLOR_FIELDS.map((field) => (
                    <ColorInput key={field.key} label={field.label} value={draft[field.key]} onChange={(v) => patch({ [field.key]: v })} />
                  ))}
                  {contrasteBaixo && (
                    <p style={{ color: '#facc15', fontSize: '12px', marginTop: '8px' }}>
                      ⚠ O contraste entre a cor da mensagem e o texto está baixo — pode ficar difícil de ler.
                    </p>
                  )}
                </div>
              )}

              {activeSection === 'mensagens' && (
                <div>
                  <h3 style={{ marginTop: 0, fontSize: '15px' }}>Formato das mensagens</h3>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    {MESSAGE_RADIUS_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => patch({ messageRadius: preset.value })}
                        style={{
                          padding: '8px 14px', fontSize: '12px', cursor: 'pointer',
                          borderRadius: `${preset.value}px`,
                          border: draft.messageRadius === preset.value ? '1px solid #38bdf8' : '1px solid var(--border-color, #0b2a44)',
                          background: draft.messageRadius === preset.value ? 'rgba(56,189,248,0.15)' : 'transparent', color: 'inherit',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <label style={{ fontSize: '13px', display: 'block', marginBottom: '18px' }}>
                    Raio: {draft.messageRadius}px
                    <input type="range" min="4" max="24" value={draft.messageRadius} onChange={(e) => patch({ messageRadius: Number(e.target.value) })} style={{ width: '100%' }} />
                  </label>

                  <h3 style={{ fontSize: '15px' }}>Tamanho da fonte</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[{ id: 'small', label: 'Pequeno' }, { id: 'normal', label: 'Normal' }, { id: 'large', label: 'Grande' }].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => patch({ fontSize: opt.id })}
                        style={{
                          padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                          border: draft.fontSize === opt.id ? '1px solid #38bdf8' : '1px solid var(--border-color, #0b2a44)',
                          background: draft.fontSize === opt.id ? 'rgba(56,189,248,0.15)' : 'transparent', color: 'inherit',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'densidade' && (
                <div>
                  <h3 style={{ marginTop: 0, fontSize: '15px' }}>Densidade do chat</h3>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    {[{ id: 'compact', label: 'Compacto' }, { id: 'comfortable', label: 'Confortável' }, { id: 'spacious', label: 'Espaçoso' }].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => patch({ messageDensity: opt.id })}
                        style={{
                          padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                          border: draft.messageDensity === opt.id ? '1px solid #38bdf8' : '1px solid var(--border-color, #0b2a44)',
                          background: draft.messageDensity === opt.id ? 'rgba(56,189,248,0.15)' : 'transparent', color: 'inherit',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <label style={{ fontSize: '13px', display: 'block' }}>
                    Transparência dos balões: {draft.bubbleOpacity}%
                    <input type="range" min="40" max="100" value={draft.bubbleOpacity} onChange={(e) => patch({ bubbleOpacity: Number(e.target.value) })} style={{ width: '100%' }} />
                  </label>
                </div>
              )}

              {activeSection === 'extras' && (
                <div>
                  <h3 style={{ marginTop: 0, fontSize: '15px' }}>Configurações extras</h3>
                  {[
                    { key: 'showTimestamp', label: 'Mostrar horário das mensagens' },
                    { key: 'showAvatar', label: 'Mostrar foto/avatar nas mensagens' },
                    { key: 'showDateSeparator', label: 'Mostrar separador de datas' },
                    { key: 'showWallpaper', label: 'Mostrar papel de parede' },
                    { key: 'animationsEnabled', label: 'Animações suaves' },
                  ].map((toggle) => (
                    <label key={toggle.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                      <span style={{ fontSize: '13px' }}>{toggle.label}</span>
                      <input
                        type="checkbox"
                        checked={draft[toggle.key] !== false}
                        onChange={(e) => patch({ [toggle.key]: e.target.checked })}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: '260px', flexShrink: 0, borderLeft: '1px solid var(--border-color, #0b2a44)', padding: '18px', overflowY: 'auto' }}>
              <p style={{ fontSize: '12px', opacity: 0.7, marginTop: 0 }}>Pré-visualização</p>
              <div
                style={{
                  ...previewCssVars,
                  borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color, #0b2a44)',
                  background: 'var(--user-bg-color, var(--bg-secondary, #081527))',
                }}
              >
                <div style={{ padding: '10px 12px', background: 'var(--user-panel-color, var(--bg-primary, #071120))', fontSize: '13px', fontWeight: 600 }}>
                  Lucas
                  <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.7 }}>Online</div>
                </div>
                <div
                  style={{
                    position: 'relative', padding: '12px', display: 'flex', flexDirection: 'column',
                    gap: 'var(--user-message-gap, 6px)', minHeight: '220px',
                    backgroundImage: 'var(--user-wallpaper-image, none)',
                    backgroundColor: 'var(--user-wallpaper-color, transparent)',
                    backgroundSize: 'var(--user-wallpaper-size, cover)',
                    backgroundRepeat: 'var(--user-wallpaper-repeat, no-repeat)',
                  }}
                >
                  <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
                    <div style={{
                      background: 'var(--user-message-received, var(--message-received, #081527))',
                      color: 'var(--user-message-received-text, var(--user-text-color, var(--text-primary, #e5e7eb)))',
                      borderRadius: 'var(--user-message-radius, 18px)',
                      padding: 'var(--user-bubble-padding-y, 8px) var(--user-bubble-padding-x, 12px)',
                      fontSize: 'var(--user-font-size, 14px)', lineHeight: 'var(--user-line-height, 1.45)',
                    }}
                    >
                      Olá, conseguiu verificar?
                    </div>
                  </div>
                  <div style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
                    <div style={{
                      background: 'var(--user-message-sent, var(--message-sent, #0F4C81))',
                      color: 'var(--user-message-sent-text, var(--user-text-color, var(--text-primary, #e5e7eb)))',
                      borderRadius: 'var(--user-message-radius, 18px)',
                      padding: 'var(--user-bubble-padding-y, 8px) var(--user-bubble-padding-x, 12px)',
                      fontSize: 'var(--user-font-size, 14px)', lineHeight: 'var(--user-line-height, 1.45)',
                    }}
                    >
                      Sim, já estou olhando.
                    </div>
                  </div>
                  <div style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
                    <div style={{
                      background: 'var(--user-message-sent, var(--message-sent, #0F4C81))',
                      color: 'var(--user-message-sent-text, var(--user-text-color, var(--text-primary, #e5e7eb)))',
                      borderRadius: 'var(--user-message-radius, 18px)',
                      padding: 'var(--user-bubble-padding-y, 8px) var(--user-bubble-padding-x, 12px)',
                      fontSize: 'var(--user-font-size, 14px)', lineHeight: 'var(--user-line-height, 1.45)',
                    }}
                    >
                      Beleza 👍
                      {draft.showTimestamp !== false && (
                        <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '2px' }}>12:41</div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--user-panel-color, var(--bg-primary, #071120))', fontSize: '12px', opacity: 0.6 }}>
                  Digite uma mensagem...
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border-color, #0b2a44)' }}>
          <button type="button" onClick={handleRestaurarPadrao} disabled={saving}>Restaurar padrão</button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={handleCancelar} disabled={saving}>Cancelar</button>
            <button type="button" onClick={handleSalvar} disabled={saving || loading}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
