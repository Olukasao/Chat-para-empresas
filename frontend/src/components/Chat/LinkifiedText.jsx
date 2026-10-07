import { Fragment } from 'react';

const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION_REGEX = /[),.;!?]+$/;
const FORMATTING_REGEX = /(\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|==([\s\S]+?)==|\*([^*\n]+?)\*)/g;

const separarUrlDePontuacao = (valor = '') => {
  const texto = String(valor);
  const pontuacao = texto.match(TRAILING_PUNCTUATION_REGEX)?.[0] || '';

  return {
    url: pontuacao ? texto.slice(0, -pontuacao.length) : texto,
    pontuacao,
  };
};

const normalizarHref = (url = '') => (
  /^https?:\/\//i.test(url) ? url : `https://${url}`
);

export default function LinkifiedText({
  text = '',
  linkClassName = '',
  renderTextSegment,
}) {
  const valor = String(text || '');
  const renderTextoBase = (texto, keyPrefix) => {
    const partes = [];
    const regex = new RegExp(URL_REGEX);
    let ultimoIndice = 0;
    let match;

    const adicionarTexto = (trecho, key) => {
      if (!trecho) return;

      partes.push(
        <Fragment key={key}>
          {renderTextSegment ? renderTextSegment(trecho) : trecho}
        </Fragment>
      );
    };

    while ((match = regex.exec(texto)) !== null) {
      adicionarTexto(
        texto.slice(ultimoIndice, match.index),
        `${keyPrefix}-text-${ultimoIndice}`
      );

      const { url, pontuacao } = separarUrlDePontuacao(match[0]);

      if (url) {
        partes.push(
          <a
            key={`${keyPrefix}-link-${match.index}`}
            className={linkClassName}
            href={normalizarHref(url)}
            target="_blank"
            rel="noopener noreferrer"
            title={normalizarHref(url)}
            onClick={(event) => event.stopPropagation()}
          >
            {url}
          </a>
        );
      }

      adicionarTexto(
        pontuacao,
        `${keyPrefix}-punctuation-${match.index}`
      );
      ultimoIndice = match.index + match[0].length;
    }

    adicionarTexto(
      texto.slice(ultimoIndice),
      `${keyPrefix}-text-${ultimoIndice}`
    );

    return partes;
  };

  const renderFormatado = (texto, keyPrefix = 'formatted') => {
    const partes = [];
    const regex = new RegExp(FORMATTING_REGEX);
    let ultimoIndice = 0;
    let match;

    while ((match = regex.exec(texto)) !== null) {
      partes.push(
        ...renderTextoBase(
          texto.slice(ultimoIndice, match.index),
          `${keyPrefix}-plain-${ultimoIndice}`
        )
      );

      const conteudo = match[2] || match[3] || match[4] || match[5] || match[6];
      const filhos = renderFormatado(
        conteudo,
        `${keyPrefix}-content-${match.index}`
      );
      const key = `${keyPrefix}-format-${match.index}`;

      if (match[2] !== undefined) {
        partes.push(<strong key={key}>{filhos}</strong>);
      } else if (match[3] !== undefined) {
        partes.push(<u key={key}>{filhos}</u>);
      } else if (match[4] !== undefined) {
        partes.push(<s key={key}>{filhos}</s>);
      } else if (match[5] !== undefined) {
        partes.push(<mark key={key}>{filhos}</mark>);
      } else {
        partes.push(<em key={key}>{filhos}</em>);
      }

      ultimoIndice = match.index + match[0].length;
    }

    partes.push(
      ...renderTextoBase(
        texto.slice(ultimoIndice),
        `${keyPrefix}-plain-${ultimoIndice}`
      )
    );

    return partes;
  };

  return renderFormatado(valor);
}
