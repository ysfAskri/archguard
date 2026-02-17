import * as vscode from "vscode";
import { runArchguardian, Finding, ScanResult } from "./runner";
import { ArchguardianCodeActionProvider } from "./code-actions";
import { createFileWatcher } from "./file-watcher";
import * as path from "path";

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let totalFindings = 0;

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("archguardian");
  context.subscriptions.push(diagnosticCollection);

  // Status bar -  shows finding count on the left side of the bar.
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "archguardian.scan";
  updateStatusBar(0);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Command: manual scan
  const scanCommand = vscode.commands.registerCommand(
    "archguardian.scan",
    () => executeScan()
  );
  context.subscriptions.push(scanCommand);

  // Command: fix finding via AI
  const fixCommand = vscode.commands.registerCommand(
    "archguardian.fixFinding",
    async (uri: vscode.Uri, diagnostic: vscode.Diagnostic) => {
      const terminal = vscode.window.createTerminal("Archguardian Fix");
      terminal.sendText(`archguardian fix --ai`);
      terminal.show();
    }
  );
  context.subscriptions.push(fixCommand);

  // Command: suppress finding with inline comment
  const suppressCommand = vscode.commands.registerCommand(
    "archguardian.suppressFinding",
    async (uri: vscode.Uri, diagnostic: vscode.Diagnostic) => {
      const editor = await vscode.window.showTextDocument(uri);
      const line = diagnostic.range.start.line;
      const lineText = editor.document.lineAt(line).text;
      const indent = lineText.match(/^\s*/)?.[0] ?? "";
      await editor.edit((editBuilder) => {
        editBuilder.insert(
          new vscode.Position(line, 0),
          `${indent}// archguard-ignore-line ${diagnostic.code}\n`
        );
      });
    }
  );
  context.subscriptions.push(suppressCommand);

  // Register code action provider
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    [
      { language: "typescript" }, { language: "javascript" },
      { language: "typescriptreact" }, { language: "javascriptreact" },
      { language: "python" }, { language: "go" },
      { language: "rust" }, { language: "java" },
    ],
    new ArchguardianCodeActionProvider(),
    { providedCodeActionKinds: ArchguardianCodeActionProvider.providedCodeActionKinds }
  );
  context.subscriptions.push(codeActionProvider);

  // File watcher for analysis on file change
  const fileWatcher = createFileWatcher(() => executeScan());
  context.subscriptions.push(fileWatcher);

  // Auto-scan on save
  const onSaveListener = vscode.workspace.onDidSaveTextDocument(() => {
    const config = vscode.workspace.getConfiguration("archguardian");
    if (config.get<boolean>("enable") && config.get<boolean>("scanOnSave")) {
      executeScan();
    }
  });
  context.subscriptions.push(onSaveListener);
}

// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------

export function deactivate(): void {
  diagnosticCollection?.dispose();
  statusBarItem?.dispose();
}

// ---------------------------------------------------------------------------
// Core scan logic
// ---------------------------------------------------------------------------

async function executeScan(): Promise<void> {
  const config = vscode.workspace.getConfiguration("archguardian");
  if (!config.get<boolean>("enable")) {
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showWarningMessage(
      "Archguardian: No workspace folder open."
    );
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;

  statusBarItem.text = "$(sync~spin) Archguardian: scanning...";

  let result: ScanResult;
  try {
    result = await runArchguardian(workspacePath);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error during scan";
    vscode.window.showErrorMessage(`Archguardian: ${message}`);
    updateStatusBar(totalFindings); // restore previous count
    return;
  }

  applyDiagnostics(result, workspacePath);
}

// ---------------------------------------------------------------------------
// Diagnostics mapping
// ---------------------------------------------------------------------------

function applyDiagnostics(result: ScanResult, workspacePath: string): void {
  diagnosticCollection.clear();

  // Group findings by file path.
  const grouped = new Map<string, vscode.Diagnostic[]>();

  for (const finding of result.findings) {
    const absPath = path.isAbsolute(finding.file)
      ? finding.file
      : path.join(workspacePath, finding.file);

    const diagnostics = grouped.get(absPath) ?? [];

    const startLine = Math.max(0, (finding.line ?? 1) - 1);
    const startCol = Math.max(0, (finding.column ?? 1) - 1);
    const endLine = finding.endLine ? finding.endLine - 1 : startLine;
    const endCol = finding.endColumn ? finding.endColumn - 1 : startCol;

    const range = new vscode.Range(startLine, startCol, endLine, endCol);

    const diagnostic = new vscode.Diagnostic(
      range,
      `[${finding.rule}] ${finding.message}`,
      mapSeverity(finding.severity)
    );
    diagnostic.source = "archguardian";
    diagnostic.code = finding.rule;

    diagnostics.push(diagnostic);
    grouped.set(absPath, diagnostics);
  }

  for (const [filePath, diagnostics] of grouped) {
    diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
  }

  totalFindings = result.findings.length;
  updateStatusBar(totalFindings);
}

function mapSeverity(severity: Finding["severity"]): vscode.DiagnosticSeverity {
  switch (severity) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "info":
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Warning;
  }
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function updateStatusBar(count: number): void {
  if (count === 0) {
    statusBarItem.text = "$(shield) Archguardian: 0 issues";
    statusBarItem.tooltip = "No issues found";
  } else {
    statusBarItem.text = `$(alert) Archguardian: ${count} issue${count === 1 ? "" : "s"}`;
    statusBarItem.tooltip = `${count} issue${count === 1 ? "" : "s"} found — click to re-scan`;
  }
}
