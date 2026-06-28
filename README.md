<div align="center">

# otak-clipboard

**Copy files, folders, and editor tabs as Markdown for AI-assisted development.**  
otak-clipboard turns VS Code Explorer selections and open editor tabs into clean Markdown code blocks, respects `.gitignore` by default, detects binary files, and can mask sensitive data before it reaches your clipboard.

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/odangoo.otak-clipboard?label=Marketplace&color=1d4ed8)](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-clipboard)
[![VS Code engine](https://img.shields.io/badge/VS%20Code-%5E1.90.0-007acc)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-otak--clipboard-24292f)](https://github.com/tsuyoshi-otake/otak-clipboard)

![Markdown output](https://img.shields.io/badge/output-Markdown%20code%20blocks-2563eb)
![Sensitive data detection](https://img.shields.io/badge/security-sensitive%20data%20masking-0f766e)
![gitignore aware](https://img.shields.io/badge/.gitignore-aware-334155)
![Binary detection](https://img.shields.io/badge/binary%20files-detected-7c3aed)
![Localized UI](https://img.shields.io/badge/UI-localized-64748b)

[**Install**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-clipboard) ·
[**GitHub**](https://github.com/tsuyoshi-otake/otak-clipboard) ·
[**Report an issue**](https://github.com/tsuyoshi-otake/otak-clipboard/issues)

</div>

---

AI-assisted coding often starts by gathering the right files and pasting them into a chat or review tool. Doing that manually is slow and easy to get wrong: paths are lost, binary files sneak in, large folders exceed practical limits, and secrets can be copied accidentally. **otak-clipboard reduces that workflow to a context menu action** and produces structured Markdown that preserves file paths and language fences.

## Quick Start

1. **Install** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-clipboard).
2. Right-click a file, folder, editor tab, or editor title area in VS Code.
3. Choose the copy command you need.
4. Paste the Markdown into an AI assistant, pull request, issue, or documentation draft.

Example output:

````markdown
# src/extension.ts

```ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    // ...
}
```
````

## Capabilities

- **Explorer copy commands**: copy a single file, a folder's immediate contents, or a folder recursively.
- **Editor tab commands**: copy the active tab or every open text tab across all tab groups.
- **Markdown-first output**: each file is copied as a Markdown section with a workspace-relative path and a language-aware code fence.
- **Robust code fences**: files containing triple backticks are wrapped safely with a longer fence when needed.
- **`.gitignore` support**: ignored files are skipped by default when copying from folders or selecting ignored workspace files.
- **Directory markers**: folders and empty folders are represented explicitly in the copied Markdown.
- **Binary file detection**: common binary formats, null bytes, and high control-character ratios are detected; binary contents are not copied.
- **Copy budgets**: default limits prevent accidental huge clipboard writes: 400 files and 400,000 characters.
- **Sensitive data protection**: API keys, tokens, credentials, connection strings, and private key headers can be detected and masked before copying.
- **Localized interface**: command titles, settings descriptions, prompts, warnings, and errors follow your VS Code display language.

## How It Works

When you run an otak-clipboard command, the extension:

1. Resolves the selected Explorer item, active tab, or open text tabs.
2. Applies `.gitignore` rules and configured excluded directories where relevant.
3. Reads text files through the VS Code workspace filesystem API.
4. Tracks the operation against the configured file and character limits.
5. Classifies directories, empty directories, binary files, and text files.
6. Scans text content for sensitive data when detection is enabled.
7. Lets you mask all matches, mask high-confidence matches, review matches one by one, continue, or cancel.
8. Writes the final Markdown to the VS Code clipboard.

## Sensitive Data Protection

Sensitive data detection is enabled by default. It is designed as a last line of defense before sharing source context with AI assistants or teammates.

Built-in detection covers common patterns such as:

- cloud provider keys and tokens
- GitHub, Slack, Stripe, npm, OpenAI, Anthropic, Google, Firebase, SendGrid, Twilio, Mailgun, and Discord tokens
- JWTs, bearer tokens, OAuth-like tokens, and generic API keys
- database connection strings and webhook URLs
- private key headers
- custom patterns that you define in settings

When matches are found, otak-clipboard shows a modal prompt with confidence levels and action choices. You stay in control of whether values are masked, reviewed individually, copied unchanged, or not copied at all.

## Settings

Customize otak-clipboard from VS Code settings.

### General

| Setting | Default | Description |
| --- | --- | --- |
| `otakClipboard.useGitignore` | `true` | Respect `.gitignore` rules and exclude matching files from copy operations |
| `otakClipboard.maxCharacters` | `400000` | Maximum characters allowed in one copy operation |
| `otakClipboard.maxFiles` | `400` | Maximum files or directory markers allowed in one copy operation |
| `otakClipboard.excludeDirectories` | `[".git", "node_modules", "out"]` | Directory names that are always skipped while copying folders |

### File Detection

| Setting | Default | Description |
| --- | --- | --- |
| `otakClipboard.knownTextExtensions` | common source and text extensions | Extensions that are always treated as text |
| `otakClipboard.knownBinaryExtensions` | `["exe", "dll", "so", "dylib", "bin", "obj"]` | Extensions that are always treated as binary |
| `otakClipboard.binaryDetectionRules` | null-byte and control-character checks enabled | Fine-tunes binary detection with `nullByteCheck`, `controlCharRatio`, and `controlCharCheck` |

### Security

| Setting | Default | Description |
| --- | --- | --- |
| `otakClipboard.detectSensitiveData` | `true` | Detect potentially sensitive values before writing to the clipboard |
| `otakClipboard.maskShowPartial` | `true` | Keep the first and last few characters visible when masking long values |
| `otakClipboard.sensitiveDataPatterns` | `[]` | Add custom `{ name, pattern, confidence }` detection rules |

## Commands

| Command | Description |
| --- | --- |
| `otakClipboard.copyCurrentTab` | Copy the active editor tab |
| `otakClipboard.copyAllOpenedTabs` | Copy all open text tabs across all tab groups |
| `otakClipboard.copyFile` | Copy the selected Explorer file |
| `otakClipboard.copyFolder` | Copy the selected folder's immediate contents |
| `otakClipboard.copyFolderRecursive` | Copy the selected folder recursively |

## Supported Scenarios

| otak-clipboard handles | Behavior |
| --- | --- |
| A selected Explorer file | Copies the file as one Markdown code block |
| A selected Explorer folder | Copies the folder marker plus shallow or recursive contents, depending on the command |
| The active editor tab | Copies the active document text |
| Open editor tabs | Copies text tabs from every tab group |
| Binary files | Adds a `(Binary File)` marker instead of copying raw bytes |
| Empty directories | Adds an `(Empty Directory)` marker |
| Files ignored by `.gitignore` | Skips them during folder copies; warns when a selected file is ignored |
| Operations above configured limits | Stops with a clear error before writing oversized content |

## Security & Privacy

otak-clipboard is designed for local development workflows.

- **Local processing**: file reading, binary detection, Markdown conversion, and sensitive data scanning run locally inside VS Code.
- **No telemetry**: the extension does not collect analytics or usage data.
- **No network calls**: copied content is not uploaded or transmitted by otak-clipboard.
- **No account or API key**: there is nothing to sign in to and nothing to provision.
- **Clipboard-only output**: the extension writes the generated Markdown to your VS Code clipboard.
- **Open source, MIT-licensed**: the implementation is auditable on [GitHub](https://github.com/tsuyoshi-otake/otak-clipboard).

## Language Support

The package manifest and runtime interface follow your VS Code display language:

**English** · 日本語 · 简体中文 · 繁體中文 · 한국어 · Tiếng Việt

## Requirements

- VS Code **1.90.0** or newer

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-clipboard), or run:

```text
ext install odangoo.otak-clipboard
```

<details>
<summary><strong>Build from source (VSIX)</strong></summary>

```bash
npm install
npm run package
code --install-extension otak-clipboard-1.1.3.vsix
```

Reload VS Code afterwards if the extension was already installed.

</details>

## Troubleshooting

- **The command is missing**: confirm the extension is installed and reload the VS Code window.
- **A file is missing from a folder copy**: check whether `.gitignore` or `otakClipboard.excludeDirectories` excluded it.
- **A folder copy stops early**: reduce the selection or raise `otakClipboard.maxFiles` / `otakClipboard.maxCharacters`.
- **A text file is marked as binary**: add its extension to `otakClipboard.knownTextExtensions` or adjust `otakClipboard.binaryDetectionRules`.
- **A sensitive data prompt appears for sample data**: review the detected item, mask it, continue intentionally, or add a more specific custom pattern.

## Related Extensions

More VS Code extensions by [odangoo](https://marketplace.visualstudio.com/publishers/odangoo):

| Extension | Description |
| --- | --- |
| [**otak-paste**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-paste) | Paste optimized screenshots into Markdown and keep repository assets smaller |
| [**otak-proxy**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-proxy) | One-click proxy switching for VS Code, Git, npm, and integrated terminals |
| [**otak-monitor**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-monitor) | Real-time CPU, memory, and disk usage in the status bar |
| [**otak-committer**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-committer) | AI-assisted commit messages, pull requests, and issues |
| [**otak-clock**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-clock) | Dual time-zone clock for the status bar |
| [**otak-pomodoro**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-pomodoro) | A Pomodoro focus timer built into VS Code |
| [**otak-restart**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-restart) | Quick Extension Host and window restart from the status bar |
| [**otak-zen**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-zen) | A calm, distraction-free Zen mode for VS Code |
| [**otak-lsp**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-lsp) | Japanese morphological analysis with grammar checks, semantic highlights, and hovers |
| [**otak-usage**](https://marketplace.visualstudio.com/items?itemName=odangoo.otak-usage) | At-a-glance usage statistics for VS Code |

## License

Released under the [MIT License](LICENSE).

<div align="center">
<br>
<sub>Built by <a href="https://github.com/tsuyoshi-otake">tsuyoshi-otake</a> · <a href="https://marketplace.visualstudio.com/items?itemName=odangoo.otak-clipboard">Marketplace</a> · <a href="https://github.com/tsuyoshi-otake/otak-clipboard">GitHub</a> · <a href="https://github.com/tsuyoshi-otake/otak-clipboard/issues">Issues</a></sub>
</div>
