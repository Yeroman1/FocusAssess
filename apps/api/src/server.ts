import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[FocusAssess API] Server listening on port ${config.port} (${config.nodeEnv})`);
  console.log(`[FocusAssess API] Base URL: ${config.apiBaseUrl}/api/v1`);
});

