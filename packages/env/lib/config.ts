import { config } from '@dotenvx/dotenvx';

export const baseEnv =
  config({
    path: `${import.meta.dirname}/../../../../.env`,
  }).parsed ?? {};

export const dynamicEnvValues = {
  IC_NODE_ENV: baseEnv.IC_DEV === 'true' ? 'development' : 'production',
} as const;
