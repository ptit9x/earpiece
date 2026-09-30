// Feature: speech recognition + conversation tuning.
import { Card, Field, Input, Select, Toggle } from '@extension/ui';
import type { EarpieceConfig } from '@extension/shared/lib/hooks/use-config';

type Props = {
  config: EarpieceConfig;
  patch: (p: Partial<EarpieceConfig>) => void;
};

const TOGGLES: { key: keyof EarpieceConfig; label: string }[] = [
  { key: 'oneOnOne', label: 'One-on-one call — every question is for you' },
  { key: 'showVietnamese', label: 'Show Vietnamese line in suggestions' },
  { key: 'debugAllRemote', label: 'DEBUG — treat every voice as someone else' },
];

const RecognitionSection = ({ config, patch }: Props) => (
  <Card title="Recognition & Conversation">
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Your name" hint="STT hears it right more often">
          <Input value={config.userName} onChange={e => patch({ userName: e.target.value })} placeholder="Viet" />
        </Field>
        <Field label="STT language">
          <Select value={config.sttLang} onChange={e => patch({ sttLang: e.target.value })}>
            <option value="en-US">English (US)</option>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="ja-JP">日本語</option>
            <option value="ko-KR">한국어</option>
            <option value="zh-CN">中文 (简体)</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Min confidence" hint="0 disables the noise gate">
          <Input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={config.minConfidence}
            onChange={e => patch({ minConfidence: Number(e.target.value) })}
          />
        </Field>
        <Field label="Target threshold" hint="Lower = more suggestions">
          <Input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={config.targetThreshold}
            onChange={e => patch({ targetThreshold: Number(e.target.value) })}
          />
        </Field>
      </div>

      {TOGGLES.map(tg => (
        <Toggle
          key={String(tg.key)}
          checked={Boolean(config[tg.key])}
          onChange={next => patch({ [tg.key]: next } as Partial<EarpieceConfig>)}
          label={tg.label}
        />
      ))}
    </div>
  </Card>
);

export default RecognitionSection;
