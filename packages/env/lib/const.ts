export const IS_DEV = process.env['CLI_IC_DEV'] === 'true';
export const IS_PROD = !IS_DEV;
export const IS_FIREFOX = process.env['CLI_IC_FIREFOX'] === 'true';
export const IS_CI = process.env['IC_CI'] === 'true';
