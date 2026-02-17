import * as vscode from "vscode";

/**
 * Creates a file watcher that triggers analysis on file save
 * for supported languages.
 */
export function createFileWatcher(
  onSave: () => void
): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/*.{ts,tsx,js,jsx,py,go,rs,java}"
  );

  const disposable = watcher.onDidChange(() => {
    const config = vscode.workspace.getConfiguration("archguardian");
    if (config.get<boolean>("enable") && config.get<boolean>("scanOnSave")) {
      onSave();
    }
  });

  return vscode.Disposable.from(watcher, disposable);
}
