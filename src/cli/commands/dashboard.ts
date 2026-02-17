import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exec } from 'node:child_process';
import { ExitCode } from '../../core/types.js';
import { getDashboardHtml } from '../dashboard-html.js';
import { isGitRepo, getGitRoot } from '../../utils/git.js';
import { logger } from '../../utils/logger.js';

export interface DashboardOptions {
  port?: number;
}

/**
 * Try to open the given URL in the user's default browser.
 * Uses platform-specific commands: xdg-open (Linux), open (macOS), start (Windows).
 */
function openBrowser(url: string): void {
  const commands = [
    'xdg-open',
    'open',
    'start',
  ];

  for (const cmd of commands) {
    try {
      // 'start' on Windows needs an empty title argument for URLs
      const fullCmd = cmd === 'start' ? `start "" "${url}"` : `${cmd} "${url}"`;
      const child = exec(fullCmd);
      child.unref();
      return;
    } catch {
      // try next
    }
  }

  logger.debug('Could not open browser automatically');
}

/**
 * Read metrics JSON from the .archguard/metrics.json file.
 */
async function loadMetrics(projectRoot: string): Promise<string> {
  const filePath = join(projectRoot, '.archguard', 'metrics.json');
  try {
    const raw = await readFile(filePath, 'utf-8');
    // Validate it's valid JSON array
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return JSON.stringify(parsed);
    }
    return '[]';
  } catch {
    return '[]';
  }
}

/**
 * Start the dashboard web server and open it in the browser.
 */
export async function dashboardCommand(options: DashboardOptions = {}): Promise<number> {
  const port = options.port ?? 3000;
  const cwd = process.cwd();

  if (!await isGitRepo(cwd)) {
    console.error('Not a git repository.');
    return ExitCode.ConfigError;
  }

  const projectRoot = await getGitRoot(cwd);
  const html = getDashboardHtml();

  const server = createServer(async (req, res) => {
    const url = req.url ?? '/';

    if (url === '/api/metrics') {
      try {
        const metricsJson = await loadMetrics(projectRoot);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        });
        res.end(metricsJson);
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('[]');
      }
      return;
    }

    if (url === '/api/history') {
      try {
        const { listRuns } = await import('../../metrics/history.js');
        const runs = await listRuns(projectRoot);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify(runs));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
      }
      return;
    }

    if (url.startsWith('/api/history/')) {
      const runId = url.replace('/api/history/', '');
      try {
        const { loadDetailedRun } = await import('../../metrics/history.js');
        const run = await loadDetailedRun(projectRoot, runId);
        if (run) {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
          res.end(JSON.stringify(run));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end('{"error":"not found"}');
        }
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"server error"}');
      }
      return;
    }

    if (url === '/api/rules-frequency') {
      try {
        const { listRuns, loadDetailedRun } = await import('../../metrics/history.js');
        const runs = await listRuns(projectRoot);
        const frequency: Record<string, number> = {};
        for (const run of runs.slice(0, 20)) {
          const detail = await loadDetailedRun(projectRoot, run.id);
          if (detail?.byRule) {
            for (const [rule, count] of Object.entries(detail.byRule)) {
              frequency[rule] = (frequency[rule] ?? 0) + count;
            }
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify(frequency));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      }
      return;
    }

    if (url === '/api/top-files') {
      try {
        const { listRuns, loadDetailedRun } = await import('../../metrics/history.js');
        const runs = await listRuns(projectRoot);
        const fileCount: Record<string, number> = {};
        for (const run of runs.slice(0, 20)) {
          const detail = await loadDetailedRun(projectRoot, run.id);
          if (detail?.byFile) {
            for (const [file, count] of Object.entries(detail.byFile)) {
              fileCount[file] = (fileCount[file] ?? 0) + count;
            }
          }
        }
        const sorted = Object.entries(fileCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify(sorted));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
      }
      return;
    }

    // Serve the HTML page for any other route
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(html);
  });

  return new Promise<number>((resolve) => {
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Try --port <other-port>.`);
      } else {
        console.error(`Server error: ${err.message}`);
      }
      resolve(ExitCode.ConfigError);
    });

    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`Dashboard running at ${url}`);
      openBrowser(url);
    });
  });
}
