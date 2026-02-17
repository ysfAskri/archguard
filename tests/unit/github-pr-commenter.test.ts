import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postPrReview, postPrSummary, parsePrContext } from '../../src/ci/github-pr-commenter.js';
import { Severity, type Finding, type AnalysisSummary } from '../../src/core/types.js';

describe('github-pr-commenter', () => {
  const mockPrContext = { owner: 'test-org', repo: 'test-repo', pullNumber: 42, token: 'ghp_test' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({}),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_PR_NUMBER;
  });

  it('posts PR review with findings', async () => {
    const findings: Finding[] = [{
      ruleId: 'security/xss', analyzer: 'security', severity: Severity.Error,
      message: 'XSS detected', file: 'src/app.ts', line: 10,
    }];

    await postPrReview(findings, mockPrContext);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (fetch as any).mock.calls[0];
    expect(url).toContain('/repos/test-org/test-repo/pulls/42/reviews');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].path).toBe('src/app.ts');
  });

  it('does not post when no findings', async () => {
    await postPrReview([], mockPrContext);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts PR summary comment', async () => {
    const summary: AnalysisSummary = {
      totalFiles: 5, totalFindings: 3, errors: 1, warnings: 2, infos: 0,
      analyzerResults: [{ analyzer: 'security', findings: [], duration: 100 }],
      duration: 500,
    };

    await postPrSummary(summary, mockPrContext);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/repos/test-org/test-repo/issues/42/comments');
  });

  it('parses PR context from env', () => {
    process.env.GITHUB_TOKEN = 'ghp_test123';
    process.env.GITHUB_REPOSITORY = 'my-org/my-repo';
    process.env.GITHUB_PR_NUMBER = '99';

    const ctx = parsePrContext();
    expect(ctx).toEqual({
      owner: 'my-org', repo: 'my-repo', pullNumber: 99, token: 'ghp_test123',
    });
  });

  it('returns null when env vars missing', () => {
    const ctx = parsePrContext();
    expect(ctx).toBeNull();
  });
});
