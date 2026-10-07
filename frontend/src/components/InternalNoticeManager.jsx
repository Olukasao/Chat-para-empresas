import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import InternalNoticeModal from './InternalNoticeModal';

const NOTICE_REFRESH_INTERVAL_MS = 60_000;

export default function InternalNoticeManager({ token, onUnauthorized }) {
  const navigate = useNavigate();
  const [notices, setNotices] = useState([]);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const currentNotice = useMemo(() => notices[0] || null, [notices]);

  const removeNoticeFromQueue = useCallback((noticeId) => {
    setNotices((current) => current.filter((notice) => Number(notice.id) !== Number(noticeId)));
  }, []);

  const loadPendingNotices = useCallback(async () => {
    if (!token) return;

    try {
      const { data } = await api.get('/internal-notices/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotices(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Erro ao carregar avisos internos pendentes:', err);

      if (err.response?.status === 401) {
        onUnauthorized?.();
      }
    }
  }, [onUnauthorized, token]);

  useEffect(() => {
    if (!token) {
      setNotices([]);
      return undefined;
    }

    loadPendingNotices();

    const intervalId = window.setInterval(() => {
      loadPendingNotices();
    }, NOTICE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadPendingNotices, token]);

  const confirmNotice = async () => {
    if (!currentNotice || !token) return;

    try {
      setActionLoading('confirm');
      setError('');

      await api.post(`/internal-notices/${currentNotice.id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      removeNoticeFromQueue(currentNotice.id);
    } catch (err) {
      console.error('Erro ao confirmar leitura do aviso interno:', err);

      if (err.response?.status === 401) {
        onUnauthorized?.();
        return;
      }

      setError(err.response?.data?.error || 'Não foi possível confirmar a leitura agora.');
    } finally {
      setActionLoading('');
    }
  };

  const snoozeNotice = async () => {
    if (!currentNotice || !token) return;

    try {
      setActionLoading('snooze');
      setError('');

      await api.post(`/internal-notices/${currentNotice.id}/snooze`, { minutes: 120 }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      removeNoticeFromQueue(currentNotice.id);
    } catch (err) {
      console.error('Erro ao lembrar aviso interno depois:', err);

      if (err.response?.status === 401) {
        onUnauthorized?.();
        return;
      }

      setError(err.response?.data?.error || 'Não foi possível lembrar o aviso depois.');
    } finally {
      setActionLoading('');
    }
  };

  const closeNotice = () => {
    if (!currentNotice?.allowClose) return;

    if (currentNotice.requireConfirmation === false) {
      confirmNotice();
      return;
    }

    removeNoticeFromQueue(currentNotice.id);
  };

  const openDetails = () => {
    if (!currentNotice?.detailUrl) return;

    removeNoticeFromQueue(currentNotice.id);

    if (/^https?:\/\//i.test(currentNotice.detailUrl)) {
      window.open(currentNotice.detailUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    navigate(currentNotice.detailUrl);
  };

  if (!currentNotice) return null;

  return (
    <InternalNoticeModal
      notice={currentNotice}
      actionLoading={actionLoading}
      error={error}
      onClose={closeNotice}
      onConfirm={confirmNotice}
      onSnooze={snoozeNotice}
      onOpenDetails={openDetails}
    />
  );
}
