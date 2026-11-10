import { createApp } from './app.js';
import { config } from './config/index.js';

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FocusAssess API] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[FocusAssess API] Uncaught Exception:', error);
});

const app = createApp();

app.listen(config.port, () => {
  console.log(`[FocusAssess API] Server listening on port ${config.port} (${config.nodeEnv})`);
  console.log(`[FocusAssess API] Base URL: ${config.apiBaseUrl}/api/v1`);
});

