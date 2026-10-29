import { spawn } from 'node:child_process';

const colors = {
  reset: '\x1b[0m',
  runner: '\x1b[36m', // Cyan
  api: '\x1b[32m',    // Green
  web: '\x1b[35m',    // Magenta
  system: '\x1b[33m', // Yellow
};

function runProcess(name, color, command, args) {
  const child = spawn(command, args, {
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  const prefix = `${color}[${name}]${colors.reset} `;

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trimEnd().length > 0) {
        console.log(`${prefix}${line.trimEnd()}`);
      }
    }
  });

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trimEnd().length > 0) {
        console.error(`${prefix}${line.trimEnd()}`);
      }
    }
  });

  return child;
}

console.log(`${colors.system}[System] Starting FocusAssess Monorepo services...${colors.reset}`);

const procs = [
  runProcess('RUNNER', colors.runner, 'npm', ['run', 'dev', '--workspace=@pyassess/python-runner']),
  runProcess('API',    colors.api,    'npm', ['run', 'dev', '--workspace=@pyassess/api']),
  runProcess('WEB',    colors.web,    'npm', ['run', 'dev', '--workspace=@pyassess/web']),
];

function shutdown() {
  console.log(`\n${colors.system}[System] Stopping all services...${colors.reset}`);
  for (const proc of procs) {
    if (proc.pid) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', proc.pid.toString(), '/T', '/F']);
        } else {
          proc.kill();
        }
      } catch {}
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

