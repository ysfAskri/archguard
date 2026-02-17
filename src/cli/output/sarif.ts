import type { AnalysisSummary, Finding } from '../../core/types.js';
import { Severity } from '../../core/types.js';

// ── SARIF v2.1.0 Type Definitions ────────────────────────────────

interface SarifMessage {
  text: string;
}

interface SarifArtifactLocation {
  uri: string;
}

interface SarifRegion {
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}

interface SarifPhysicalLocation {
  artifactLocation: SarifArtifactLocation;
  region: SarifRegion;
}

interface SarifLocation {
  physicalLocation: SarifPhysicalLocation;
}

interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: SarifMessage;
  locations: SarifLocation[];
}

interface SarifRuleDescriptor {
  id: string;
  shortDescription: SarifMessage;
  helpUri?: string;
}

interface SarifToolDriver {
  name: string;
  version: string;
  rules: SarifRuleDescriptor[];
}

interface SarifTool {
  driver: SarifToolDriver;
}

interface SarifRun {
  tool: SarifTool;
  results: SarifResult[];
}

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

// ── Severity Mapping ─────────────────────────────────────────────

function toSarifLevel(severity: Severity): 'error' | 'warning' | 'note' {
  switch (severity) {
    case Severity.Error:
      return 'error';
    case Severity.Warning:
      return 'warning';
    case Severity.Info:
      return 'note';
  }
}

// ── SARIF Formatter ──────────────────────────────────────────────

export function formatSarif(summary: AnalysisSummary): string {
  const allFindings: Finding[] = [];
  for (const result of summary.analyzerResults) {
    for (const finding of result.findings) {
      allFindings.push(finding);
    }
  }

  // Collect unique rules from all findings
  const rulesMap = new Map<string, SarifRuleDescriptor>();
  for (const finding of allFindings) {
    if (!rulesMap.has(finding.ruleId)) {
      rulesMap.set(finding.ruleId, {
        id: finding.ruleId,
        shortDescription: { text: finding.message },
        helpUri: `https://github.com/archguardian/archguardian#${finding.ruleId.replace(/\//g, '-')}`,
      });
    }
  }

  // Build SARIF results
  const results: SarifResult[] = allFindings.map((finding) => {
    const region: SarifRegion = {
      startLine: finding.line,
    };
    if (finding.column !== undefined) {
      region.startColumn = finding.column;
    }
    if (finding.endLine !== undefined) {
      region.endLine = finding.endLine;
    }
    if (finding.endColumn !== undefined) {
      region.endColumn = finding.endColumn;
    }

    return {
      ruleId: finding.ruleId,
      level: toSarifLevel(finding.severity),
      message: { text: finding.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: finding.file },
            region,
          },
        },
      ],
    };
  });

  const sarifLog: SarifLog = {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'archguardian',
            version: '1.0.0',
            rules: Array.from(rulesMap.values()),
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarifLog, null, 2);
}
