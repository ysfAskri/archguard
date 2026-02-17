---
name: suppress
description: Add archguard-ignore suppression comments to silence false positives
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit
---

# archguardian suppress

Help the user add inline suppression comments to silence specific archguardian findings.

## Instructions

1. If $ARGUMENTS contains a file path or rule ID, scope to that. Otherwise, run a scan first:
   ```bash
   npx archguardian scan --format json
   ```

2. For each finding the user wants to suppress, determine the best approach:

   - **Same-line suppression** (preferred for short lines):
     ```
     doSomething(); // archguard-ignore-line
     doSomething(); // archguard-ignore-line security/xss
     ```

   - **Next-line suppression** (preferred for long lines):
     ```
     // archguard-ignore
     doSomething();
     // archguard-ignore security/xss
     doSomething();
     ```

   - **Python** uses `#` instead of `//`:
     ```python
     do_something()  # archguard-ignore-line
     ```

   - **Block comments** also work:
     ```
     /* archguard-ignore */
     doSomething();
     ```

3. Always prefer rule-specific suppression (`archguard-ignore-line security/xss`) over blanket suppression (`archguard-ignore-line`) to keep other rules active on that line.

4. Apply the edit using the Edit tool.

5. After adding suppressions, run a quick scan to confirm the findings are gone:
   ```bash
   npx archguardian scan --format json
   ```

## Tips

- Only suppress genuine false positives. If the finding is valid, fix the code instead.
- When suppressing, add a brief reason comment if it's not obvious why it's suppressed.
- If many findings of the same type are false positives, consider disabling that rule in `.archguard.yml` instead.
