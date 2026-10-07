export const MESSAGE_REACTION_OPTIONS = ['👍', '✅', '👀'];

export const getReactionUsersTitle = (reaction = {}) => {
  const nomes = Array.isArray(reaction.users)
    ? reaction.users.map((user) => user.nome).filter(Boolean)
    : [];

  return nomes.length ? nomes.join(', ') : 'Sem detalhes';
};

export const copyTextToClipboard = async (text) => {
  const value = String(text || '');

  if (!value.trim()) return false;

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  return copied;
};
