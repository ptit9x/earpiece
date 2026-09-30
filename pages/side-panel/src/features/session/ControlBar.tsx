import { t } from '@extension/i18n';
import { Button } from '@extension/ui';

type Props = {
  listening: boolean;
  busy: boolean;
  onToggle: () => void;
  onAnswerLast: () => void;
};

const ControlBar = ({ listening, busy, onToggle, onAnswerLast }: Props) => (
  <div className="grid grid-cols-2 gap-2 p-4 pb-2">
    <Button variant={listening ? 'danger' : 'primary'} onClick={onToggle} disabled={busy} className="w-full">
      {listening ? t('panelStopListening') : t('panelStartListening')}
    </Button>
    <Button variant="ghost" onClick={onAnswerLast} disabled={busy} className="w-full">
      ✨ {t('panelAnswerThat')}
    </Button>
  </div>
);

export default ControlBar;
