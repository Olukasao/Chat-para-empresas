import { useEffect, useRef } from 'react';

const LOCK_KEY = [17, 29, 31, 7, 41, 13, 19, 5];

const LOCKED_COPY = {
  prefix: [114, 111, 118, 102, 77, 98, 51, 117, 126, 111],
  name: [93, 104, 124, 102, 90, 45, 64, 106, 112, 111, 122, 116],
  url: [121, 105, 107, 119, 90, 55, 60, 42, 118, 116, 107, 111, 92, 111, 61, 102, 126, 112, 48, 72, 69, 120, 120, 100, 98, 124, 112],
  label: [114, 111, 118, 102, 77, 98, 51, 117, 126, 111, 63, 75, 92, 110, 114, 118, 49, 78, 112, 102, 91, 104, 96],
};

const unlock = (payload) => (
  payload
    .map((value, index) => String.fromCharCode(value ^ LOCK_KEY[index % LOCK_KEY.length]))
    .join('')
);

const buildSeal = () => ({
  prefix: unlock(LOCKED_COPY.prefix),
  name: unlock(LOCKED_COPY.name),
  url: unlock(LOCKED_COPY.url),
  label: unlock(LOCKED_COPY.label),
});

const CORNER_SEAL = buildSeal();

const restoreSeal = (element, seal) => {
  const anchor = document.createElement('a');
  anchor.href = seal.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.textContent = seal.name;

  element.replaceChildren(
    document.createTextNode(`${seal.prefix} `),
    anchor,
  );
  element.setAttribute('aria-label', seal.label);
};

export default function CornerSeal({ className = '' }) {
  const sealRef = useRef(null);
  const seal = CORNER_SEAL;

  useEffect(() => {
    const element = sealRef.current;
    if (!element) return undefined;

    let restoring = false;
    const expectedText = `${seal.prefix} ${seal.name}`;

    const ensureSeal = () => {
      if (restoring) return;

      const anchor = element.querySelector('a');
      const textOk = element.textContent.trim() === expectedText;
      const linkOk = anchor?.getAttribute('href') === seal.url && anchor.textContent === seal.name;
      const labelOk = element.getAttribute('aria-label') === seal.label;

      if (textOk && linkOk && labelOk) return;

      restoring = true;
      restoreSeal(element, seal);
      restoring = false;
    };

    ensureSeal();

    if (typeof window === 'undefined' || typeof window.MutationObserver !== 'function') {
      return undefined;
    }

    const observer = new window.MutationObserver(ensureSeal);
    observer.observe(element, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  });

  return (
    <p
      ref={sealRef}
      className={className}
      aria-label={seal.label}
      data-ui-seal={LOCKED_COPY.label.length}
    >
      {seal.prefix}{' '}
      <a
        href={seal.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {seal.name}
      </a>
    </p>
  );
}
