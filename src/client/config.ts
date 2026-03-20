import userConfig from '../../haste.config';
import { AppConfig } from './app-controller';

const defaults: AppConfig = {
  appName: 'Haste',
  enableTwitter: true,
  scrollToTopOnSave: true,
  lineNumbers: true,
};

export const config: AppConfig = {
  ...defaults,
  ...userConfig,
};

export default config;
