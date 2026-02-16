import { execFile } from "child_process";

export interface Finding {
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: "error" | "warning" | "info";
  rule: string;
  category?: string;
  suggestion?: string;
}

export interface ScanResult {
  findings: Finding[];
  summary: {
    totalFiles: number;
    totalFindings: number;
    errors: number;
    warnings: number;
    infos: number;
    duration: number;
  };
}

const SCAN_TIMEOUT_MS = 60_000;

/**
 * Execute the archguardian CLI and return parsed scan results.
 *
 * Runs `npx archguardian scan --format json` inside the given workspace.
 * The CLI may print non-JSON text (spinners, etc.) before the JSON block,
 * so we extract the JSON portion from stdout.
 */
export function runArchguardian(workspacePath: string): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "npx",
      ["archguardian", "scan", "--format", "json"],
      {
        cwd: workspacePath,
        timeout: SCAN_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
        shell: true,
        env: { ...process.env, NO_COLOR: "1" },
      },
      (error, stdout, stderr) => {
        // Even if exit code is non-zero, the CLI still produces JSON output
        // when findings are detected (exit code 1 = errors found).
        // Only reject on actual execution failures.
        if (error && !stdout) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            reject(
              new Error(
                "archguardian not found. Run: npm install -g archguardian"
              )
            );
            return;
          }
          if (error.killed) {
            reject(
              new Error(
                `Scan timed out after ${SCAN_TIMEOUT_MS / 1000}s`
              )
            );
            return;
          }
          reject(
            new Error(
              `Scan failed: ${stderr?.trim() || error.message}`
            )
          );
          return;
        }

        // Extract JSON from stdout — CLI may print spinner text before it
        const jsonStart = stdout.indexOf("{");
        if (jsonStart < 0) {
          reject(
            new Error(
              "No JSON output from archguardian. Make sure .archguard.yml exists in your project."
            )
          );
          return;
        }

        try {
          const jsonStr = stdout.slice(jsonStart);
          const parsed = JSON.parse(jsonStr);

          // Map from CLI JSON format to extension format
          const findings: Finding[] = (parsed.findings ?? []).map(
            (f: Record<string, unknown>) => ({
              file: f.file as string,
              line: f.line as number,
              column: 1,
              message: f.message as string,
              severity: f.severity as Finding["severity"],
              rule: f.ruleId as string,
              suggestion: f.suggestion as string | undefined,
            })
          );

          resolve({ findings, summary: parsed.summary });
        } catch {
          reject(
            new Error(
              `Failed to parse scan output: ${stdout.slice(0, 200)}`
            )
          );
        }
      }
    );

    child.on("error", (err) => {
      reject(new Error(`Failed to start archguardian: ${err.message}`));
    });
  });
}
