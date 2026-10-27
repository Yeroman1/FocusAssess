import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[PyAssess API] Server listening on port ${config.port} (${config.nodeEnv})`);
  console.log(`[PyAssess API] Base URL: ${config.apiBaseUrl}/api/v1`);
});
