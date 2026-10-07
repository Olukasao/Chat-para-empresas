import styles from '../../styles/Chat.module.css';

const FORMAT_OPTIONS = [
  {
    label: 'B',
    title: 'Negrito',
    format: 'bold',
    className: styles.formatButtonBold,
  },
  {
    label: 'I',
    title: 'Itálico',
    format: 'italic',
    className: styles.formatButtonItalic,
  },
  {
    label: 'U',
    title: 'Sublinhado',
    format: 'underline',
    className: styles.formatButtonUnderline,
  },
  {
    label: 'S',
    title: 'Riscado',
    format: 'strike',
    className: styles.formatButtonStrike,
  },
  {
    label: 'A',
    title: 'Destacar texto',
    format: 'highlight',
    className: styles.formatButtonHighlight,
  },
];

export default function MessageFormattingToolbar({ inputRef }) {
  return (
    <div className={styles.formatToolbar} aria-label="Formatação da mensagem">
      {FORMAT_OPTIONS.map((option) => (
        <button
          key={option.title}
          type="button"
          className={`${styles.formatButton} ${option.className}`}
          title={option.title}
          aria-label={option.title}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => inputRef.current?.applyFormat(option.format)}
        >
          {option.label}
        </button>
      ))}
      <span className={styles.formatToolbarHint}>
        Enter envia · Shift + Enter quebra a linha
      </span>
    </div>
  );
}
