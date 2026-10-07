const FORMATTING_REGEX = /(\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|==([\s\S]+?)==|\*([^*\n]+?)\*)/g;

export const removerFormatacaoMensagem = (value = '') => {
  let result = String(value || '');
  let previousResult;

  do {
    previousResult = result;
    result = result.replace(
      FORMATTING_REGEX,
      (match, formatted, bold, underline, strike, highlight, italic) => (
        bold || underline || strike || highlight || italic || match
      )
    );
  } while (result !== previousResult);

  return result;
};
