import type { dynamicEnvValues } from './index.js';

interface ICebEnv {
  readonly IC_EXAMPLE: string;
  readonly IC_DEV_LOCALE: string;
}

interface ICebCliEnv {
  readonly CLI_IC_DEV: string;
  readonly CLI_IC_FIREFOX: string;
}

export type EnvType = ICebEnv & ICebCliEnv & typeof dynamicEnvValues;
