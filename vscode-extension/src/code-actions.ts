import * as vscode from "vscode";

/**
 * Provides code actions for archguardian diagnostics:
 * - Quick fix: Run AI fix
 * - Suppress: Add inline suppression comment
 */
export class ArchguardianCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== "archguardian") continue;

      // Quick fix: AI fix
      const fixAction = new vscode.CodeAction(
        `Fix with AI: ${diagnostic.code}`,
        vscode.CodeActionKind.QuickFix
      );
      fixAction.command = {
        command: "archguardian.fixFinding",
        title: "Fix with AI",
        arguments: [document.uri, diagnostic],
      };
      fixAction.diagnostics = [diagnostic];
      fixAction.isPreferred = true;
      actions.push(fixAction);

      // Suppress: Add inline comment
      const suppressAction = new vscode.CodeAction(
        `Suppress: ${diagnostic.code}`,
        vscode.CodeActionKind.QuickFix
      );
      suppressAction.command = {
        command: "archguardian.suppressFinding",
        title: "Suppress finding",
        arguments: [document.uri, diagnostic],
      };
      suppressAction.diagnostics = [diagnostic];
      actions.push(suppressAction);
    }

    return actions;
  }
}
