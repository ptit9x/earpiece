import { t } from '@extension/i18n';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import type { Turn, Translation } from './types';

type Props = {
  turns: Turn[];
  translations: Record<string, Translation>;
  onSuggest: (id: string) => void;
  onTranslate: (id: string) => void;
  onCopy: (text: string) => void;
};

type TurnProps = {
  turn: Turn;
  trans?: Translation;
  onSuggest: (id: string) => void;
  onTranslate: (id: string) => void;
  onCopy: (text: string) => void;
};

const TurnBubble = ({ turn, trans, onSuggest, onTranslate, onCopy }: TurnProps) => {
  const isMe = turn.speaker === 'me';
  const text = turn.parts?.length ? turn.parts.join(' ') : turn.text;

  const iconBtn =
    'flex h-6 w-6 items-center justify-center rounded-md border border-ep-border bg-ep-surface-2 text-[10px] text-ep-muted hover:border-ep-border-strong hover:text-ep-text';

  return (
    <div className={`group flex max-w-[88%] flex-col ${isMe ? 'items-end self-end' : 'items-start self-start'}`}>
      <div className="flex items-start gap-1.5">
        {!isMe && (
          <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              className={iconBtn}
              title={t('panelTranscriptHint')}
              onClick={() => onTranslate(turn.id)}>
              🌐
            </button>
            <button type="button" className={iconBtn} title={t('panelAskAi')} onClick={() => onSuggest(turn.id)}>
              ✨
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => onSuggest(turn.id)}
          title={t('panelAskAi')}
          className={
            isMe
              ? 'animate-fade-in shadow-ep rounded-xl rounded-br-sm bg-gradient-to-br from-[var(--ep-accent)] to-[var(--ep-accent-2)] px-3.5 py-2 text-left text-[13px] leading-relaxed text-white'
              : 'animate-fade-in border-ep-border bg-ep-surface-2 text-ep-text hover:border-ep-border-strong rounded-xl rounded-bl-sm border px-3.5 py-2 text-left text-[13px] leading-relaxed'
          }>
          {!isMe && (
            <div className="text-ep-faint mb-0.5 text-[9px] font-bold uppercase tracking-[0.14em]">
              {turn.speaker === 'remote' ? t('panelSpeakerThem').toUpperCase() : turn.speaker.toUpperCase()}
            </div>
          )}
          <span>{text}</span>
        </button>
        {isMe && (
          <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              className={iconBtn}
              title={t('panelTranscriptHint')}
              onClick={() => onTranslate(turn.id)}>
              🌐
            </button>
            <button type="button" className={iconBtn} title={t('panelCopy')} onClick={() => onCopy(text)}>
              📋
            </button>
          </div>
        )}
      </div>

      {trans && !trans.pending && !trans.error && trans.vi && (
        <div className="animate-fade-in border-[var(--ep-accent)]/50 text-ep-muted mt-1 max-w-full border-l-2 pl-2 text-[11px] leading-relaxed">
          {trans.vi}
        </div>
      )}
      {trans?.pending && <div className="text-ep-faint mt-1 text-[10px]">{t('panelTranslating')}</div>}
      {trans?.error && <div className="mt-1 text-[10px] text-[var(--ep-danger)]">{trans.error}</div>}
    </div>
  );
};

const Transcript = ({ turns, translations, onSuggest, onTranslate, onCopy }: Props) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const container = (
    <div className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
      <h2 className="text-ep-faint mb-2 text-[10px] font-bold uppercase tracking-[0.14em]">
        {t('panelTranscript')}{' '}
        <span className="font-normal normal-case tracking-normal opacity-80">{t('panelTranscriptHint')}</span>
      </h2>
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1 [scroll-behavior:smooth]">
        {turns.map(turn => (
          <TurnBubble
            key={turn.id}
            turn={turn}
            trans={translations[turn.id]}
            onSuggest={onSuggest}
            onTranslate={onTranslate}
            onCopy={onCopy}
          />
        ))}
      </div>
    </div>
  );
  // keep isLight referenced for re-render on theme change
  void isLight;
  return container;
};

export default Transcript;
