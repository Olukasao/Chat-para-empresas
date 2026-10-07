import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

const FORMATTING_REGEX = /(\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|==([\s\S]+?)==|\*([^*\n]+?)\*)/g;
const BLOCK_TAGS = new Set(['DIV', 'P']);
const HIGHLIGHT_COLOR = '#fde68a';
const HIGHLIGHT_COLOR_VALUES = new Set([
  HIGHLIGHT_COLOR,
  'rgb(253,230,138)',
  'rgba(253,230,138,1)',
]);
const CLIPBOARD_IMAGE_EXTENSION_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};

const execEditorCommand = (command, showUi = false, value = null) => {
  try {
    return document.execCommand(command, showUi, value);
  } catch {
    return false;
  }
};

const normalizeCssColor = (value = '') => (
  String(value || '').trim().toLowerCase().replace(/\s+/g, '')
);

const isKnownHighlightColor = (value = '') => (
  HIGHLIGHT_COLOR_VALUES.has(normalizeCssColor(value))
);

const hasVisibleBackgroundColor = (value = '') => {
  const normalizedColor = normalizeCssColor(value);

  return Boolean(normalizedColor)
    && normalizedColor !== 'transparent'
    && normalizedColor !== 'rgba(0,0,0,0)';
};

const clearHighlightCommandState = () => (
  execEditorCommand('hiliteColor', false, 'transparent')
  || execEditorCommand('backColor', false, 'transparent')
);

const hasActiveHighlightCommand = () => {
  if (typeof document.queryCommandValue !== 'function') return false;

  try {
    return ['hiliteColor', 'backColor'].some((command) => (
      isKnownHighlightColor(document.queryCommandValue(command))
    ));
  } catch {
    return false;
  }
};

const appendFormattedContent = (container, value) => {
  const text = String(value || '');
  const regex = new RegExp(FORMATTING_REGEX);
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.append(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const content = match[2] || match[3] || match[4] || match[5] || match[6];
    let element;

    if (match[2] !== undefined) {
      element = document.createElement('strong');
    } else if (match[3] !== undefined) {
      element = document.createElement('u');
    } else if (match[4] !== undefined) {
      element = document.createElement('s');
    } else if (match[5] !== undefined) {
      element = document.createElement('mark');
    } else {
      element = document.createElement('em');
    }

    appendFormattedContent(element, content);
    container.append(element);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    container.append(document.createTextNode(text.slice(lastIndex)));
  }
};

const wrapSerializedContent = (element, content) => {
  const tagName = element.tagName;
  const style = element.style;
  let result = content;

  if (
    tagName === 'MARK'
    || isKnownHighlightColor(style.backgroundColor)
  ) {
    result = `==${result}==`;
  }

  if (
    tagName === 'S'
    || tagName === 'STRIKE'
    || tagName === 'DEL'
    || style.textDecoration.includes('line-through')
  ) {
    result = `~~${result}~~`;
  }

  if (tagName === 'U' || style.textDecoration.includes('underline')) {
    result = `__${result}__`;
  }

  if (tagName === 'EM' || tagName === 'I' || style.fontStyle === 'italic') {
    result = `*${result}*`;
  }

  if (
    tagName === 'STRONG'
    || tagName === 'B'
    || style.fontWeight === 'bold'
    || Number.parseInt(style.fontWeight, 10) >= 600
  ) {
    result = `**${result}**`;
  }

  return result;
};

const serializeChildren = (node) => {
  let result = '';

  Array.from(node.childNodes).forEach((child, index, children) => {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.nodeValue || '';
      return;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) return;

    if (child.tagName === 'BR') {
      result += '\n';
      return;
    }

    const isBlock = BLOCK_TAGS.has(child.tagName);

    if (isBlock && result && !result.endsWith('\n')) {
      result += '\n';
    }

    result += wrapSerializedContent(child, serializeChildren(child));

    if (isBlock && index < children.length - 1 && !result.endsWith('\n')) {
      result += '\n';
    }
  });

  return result;
};

const serializeEditor = (editor) => (
  serializeChildren(editor)
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\r/g, '')
);

const plainTextFromNode = (node) => {
  if (!node) return '';

  let result = '';

  Array.from(node.childNodes).forEach((child, index, children) => {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.nodeValue || '';
      return;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) return;

    if (child.tagName === 'BR') {
      result += '\n';
      return;
    }

    const isBlock = BLOCK_TAGS.has(child.tagName);

    if (isBlock && result && !result.endsWith('\n')) {
      result += '\n';
    }

    result += plainTextFromNode(child);

    if (isBlock && index < children.length - 1 && !result.endsWith('\n')) {
      result += '\n';
    }
  });

  return result.replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
};

const selectionBelongsToEditor = (editor, range) => (
  editor.contains(range.startContainer) && editor.contains(range.endContainer)
);

const elementMatchesFormat = (element, format) => {
  if (!(element instanceof HTMLElement)) return false;

  const tagName = element.tagName;
  const style = element.style;

  if (format === 'bold') {
    return (
      tagName === 'STRONG'
      || tagName === 'B'
      || style.fontWeight === 'bold'
      || Number.parseInt(style.fontWeight, 10) >= 600
    );
  }

  if (format === 'italic') {
    return tagName === 'EM' || tagName === 'I' || style.fontStyle === 'italic';
  }

  if (format === 'underline') {
    return tagName === 'U' || style.textDecoration.includes('underline');
  }

  if (format === 'strike') {
    return (
      tagName === 'S'
      || tagName === 'STRIKE'
      || tagName === 'DEL'
      || style.textDecoration.includes('line-through')
    );
  }

  if (format === 'highlight') {
    return (
      tagName === 'MARK'
      || hasVisibleBackgroundColor(style.backgroundColor)
    );
  }

  return false;
};

const getBoundaryNode = (container, offset, usePreviousNode = false) => {
  if (container.nodeType !== Node.ELEMENT_NODE) return container;

  const children = container.childNodes;

  if (!children.length) return container;

  const index = usePreviousNode
    ? Math.max(0, Math.min(offset - 1, children.length - 1))
    : Math.min(offset, children.length - 1);

  return children[index] || container;
};

const findFormatAncestor = (node, editor, format) => {
  let element = node.nodeType === Node.ELEMENT_NODE
    ? node
    : node.parentElement;

  while (element && element !== editor) {
    if (elementMatchesFormat(element, format)) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
};

const removeActiveFormat = (editor, format) => {
  const selection = window.getSelection();

  if (!selection?.rangeCount) return false;

  const range = selection.getRangeAt(0);

  if (!selectionBelongsToEditor(editor, range)) return false;

  const startNode = getBoundaryNode(range.startContainer, range.startOffset);
  const endNode = getBoundaryNode(
    range.endContainer,
    range.endOffset,
    !range.collapsed
  );
  const startElement = findFormatAncestor(startNode, editor, format);
  const endElement = findFormatAncestor(endNode, editor, format);

  if (!startElement || startElement !== endElement) return false;

  const children = Array.from(startElement.childNodes);
  startElement.replaceWith(...children);
  editor.focus();
  return true;
};

const getTextBeforeCursor = (editor) => {
  const selection = window.getSelection();

  if (!selection?.rangeCount) return plainTextFromNode(editor);

  const currentRange = selection.getRangeAt(0);

  if (!selectionBelongsToEditor(editor, currentRange)) {
    return plainTextFromNode(editor);
  }

  const range = currentRange.cloneRange();
  range.selectNodeContents(editor);
  range.setEnd(currentRange.startContainer, currentRange.startOffset);

  return plainTextFromNode(range.cloneContents());
};

const getPointAtOffset = (editor, targetOffset) => {
  const walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return node.tagName === 'BR'
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    }
  );
  let remaining = Math.max(0, targetOffset);
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.nodeValue?.length || 0;

      if (remaining <= length) {
        return { node, offset: remaining };
      }

      remaining -= length;
    } else {
      const parent = node.parentNode;
      const index = Array.prototype.indexOf.call(parent.childNodes, node);

      if (remaining === 0) {
        return { node: parent, offset: index };
      }

      if (remaining === 1) {
        return { node: parent, offset: index + 1 };
      }

      remaining -= 1;
    }

    node = walker.nextNode();
  }

  return { node: editor, offset: editor.childNodes.length };
};

const getEndPoint = (editor) => {
  if (!editor.lastChild) {
    return { node: editor, offset: 0 };
  }

  let node = editor.lastChild;

  while (node.lastChild) {
    node = node.lastChild;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return { node, offset: node.nodeValue?.length || 0 };
  }

  return {
    node: node.parentNode || editor,
    offset: Array.prototype.indexOf.call((node.parentNode || editor).childNodes, node) + 1,
  };
};

const isImageFile = (file) => (
  Boolean(file) && String(file.type || '').toLowerCase().startsWith('image/')
);

const normalizeClipboardImageFile = (file, index) => {
  if (!isImageFile(file) || file.name) return file;

  if (typeof File !== 'function') return file;

  const mime = String(file.type || 'image/png').toLowerCase();
  const extension = CLIPBOARD_IMAGE_EXTENSION_BY_MIME[mime] || 'png';
  const suffix = index > 0 ? `-${index + 1}` : '';

  return new File(
    [file],
    `imagem-colada-${Date.now()}${suffix}.${extension}`,
    {
      type: file.type || 'image/png',
      lastModified: Date.now(),
    }
  );
};

const getClipboardImageFiles = (clipboardData) => {
  if (!clipboardData) return [];

  const files = Array.from(clipboardData.files || []).filter(isImageFile);

  if (files.length) {
    return files.map(normalizeClipboardImageFile);
  }

  return Array.from(clipboardData.items || [])
    .filter((item) => (
      item.kind === 'file'
      && String(item.type || '').toLowerCase().startsWith('image/')
    ))
    .map((item) => item.getAsFile())
    .filter(isImageFile)
    .map(normalizeClipboardImageFile);
};

const getClipboardText = (clipboardData) => {
  const plainText = clipboardData.getData('text/plain');

  if (plainText) return plainText;

  const html = clipboardData.getData('text/html');

  if (!html) return '';

  const template = document.createElement('template');
  template.innerHTML = html;

  return plainTextFromNode(template.content);
};

const RichMessageEditor = forwardRef(function RichMessageEditor({
  className,
  placeholder,
  value,
  onChange,
  onKeyDown,
  onPasteFiles,
}, ref) {
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);

  const saveSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection?.rangeCount) return;

    const range = selection.getRangeAt(0);

    if (selectionBelongsToEditor(editor, range)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection) return;

    editor.focus();

    const savedRange = savedRangeRef.current;
    const range = document.createRange();

    if (savedRange && selectionBelongsToEditor(editor, savedRange)) {
      range.setStart(savedRange.startContainer, savedRange.startOffset);
      range.setEnd(savedRange.endContainer, savedRange.endOffset);
    } else {
      const endPoint = getEndPoint(editor);
      range.setStart(endPoint.node, endPoint.offset);
      range.collapse(true);
    }

    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const syncValue = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const serializedValue = serializeEditor(editor);
    const plainValue = plainTextFromNode(editor);
    const textBeforeCursor = getTextBeforeCursor(editor);

    onChange?.({
      target: {
        value: serializedValue,
        plainValue,
        selectionStart: textBeforeCursor.length,
      },
    });
    saveSelection();
  }, [onChange, saveSelection]);

  const insertText = useCallback((text) => {
    const editor = editorRef.current;
    if (!editor) return;

    restoreSelection();
    document.execCommand('insertText', false, text);
    syncValue();
    saveSelection();
  }, [restoreSelection, saveSelection, syncValue]);

  const replaceTextRange = useCallback((start, end, text) => {
    const editor = editorRef.current;
    if (!editor) return;

    const startPoint = getPointAtOffset(editor, start);
    const endPoint = getPointAtOffset(editor, end);
    const range = document.createRange();
    const selection = window.getSelection();

    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    selection.removeAllRanges();
    selection.addRange(range);
    saveSelection();
    document.execCommand('insertText', false, text);
    syncValue();
  }, [saveSelection, syncValue]);

  const applyFormat = useCallback((format) => {
    const editor = editorRef.current;
    if (!editor) return;

    restoreSelection();

    if (removeActiveFormat(editor, format)) {
      if (format === 'highlight') {
        clearHighlightCommandState();
      }

      syncValue();
      return;
    }

    const commands = {
      bold: ['bold'],
      italic: ['italic'],
      underline: ['underline'],
      strike: ['strikeThrough'],
      highlight: ['hiliteColor', HIGHLIGHT_COLOR],
    };
    const [command, commandValue = null] = commands[format] || [];

    if (!command) return;

    if (command === 'hiliteColor') {
      if (hasActiveHighlightCommand()) {
        clearHighlightCommandState();
        syncValue();
        return;
      }

      if (!execEditorCommand(command, false, commandValue)) {
        execEditorCommand('backColor', false, commandValue);
      }
    } else if (command !== 'hiliteColor') {
      execEditorCommand(command, false, commandValue);
    }

    syncValue();
  }, [restoreSelection, syncValue]);

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    applyFormat,
    insertText,
    replaceTextRange,
    getPlainText: () => plainTextFromNode(editorRef.current),
    getTextBeforeCursor: () => getTextBeforeCursor(editorRef.current),
  }), [applyFormat, insertText, replaceTextRange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || serializeEditor(editor) === value) return;

    editor.replaceChildren();
    appendFormattedContent(editor, value);
  }, [value]);

  const handleKeyDown = (event) => {
    onKeyDown?.(event);

    if (event.defaultPrevented) return;

    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      document.execCommand('insertLineBreak');
      syncValue();
    }
  };

  const handlePaste = (event) => {
    if (!event.clipboardData) {
      return;
    }

    const pastedImages = getClipboardImageFiles(event.clipboardData);

    if (pastedImages.length && onPasteFiles) {
      event.preventDefault();
      onPasteFiles(pastedImages);
      return;
    }

    const clipboardText = getClipboardText(event.clipboardData);

    if (clipboardText) {
      event.preventDefault();
      clearHighlightCommandState();
      execEditorCommand('insertText', false, clipboardText);
      clearHighlightCommandState();
      syncValue();
      saveSelection();
    }
  };

  return (
    <div
      ref={editorRef}
      className={className}
      contentEditable
      role="textbox"
      aria-label={placeholder}
      aria-multiline="true"
      data-placeholder={placeholder}
      suppressContentEditableWarning
      onInput={syncValue}
      onKeyUp={saveSelection}
      onMouseUp={saveSelection}
      onFocus={saveSelection}
      onBlur={saveSelection}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    />
  );
});

export default RichMessageEditor;
