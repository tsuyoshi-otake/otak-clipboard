# CHANGELOG

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-03-03
### Added
- Initial release of **otak-clipboard** extension.
- Context menu integration for both Explorer and editor tabs:
    - Explorer context menu commands:
        - `Copy File`: Copy content of a single file.
        - `Copy Folder Contents`: Copy immediate children of the selected folder (without subdirectories).
        - `Copy All Folder Contents`: Copy entire folder contents recursively including all nested files and directories.
    - Editor tabs context menu commands:
        - `Copy Current Tab`: Copy content from the currently active editor tab.
        - `Copy All Opened Tabs`: Copy content from all open tabs across all tab groups.
- Intelligent markdown formatting of clipboard output:
    - Clearly structure file and folder paths to deliver context-aware clipboard content optimized for generative AI workflows.
    - Syntax-highlighted markdown blocks automatically derived from file extensions.
- Comprehensive binary file detection mechanisms:
    - Multi-level binary detection:
        - File signature (magic numbers) checks.
        - Null byte detection to guess binary status.
        - Control character ratio analysis.
    - Configurable overrides via file extensions lists (`knownTextExtensions`, `knownBinaryExtensions`).
- Integration with `.gitignore` rules to automatically exclude ignored files from clipboard operations (configurable).
- Configurable limits to protect user performance and clipboard usability:
    - Maximum character limit per copy operation (default: 400,000 characters ≈ 100K tokens).
    - Maximum file limit per copy operation (default: 50 files).
    - Default-excluded directories (`.git`, `node_modules`, `out`) fully customizable in the settings.
- User-friendly notifications implemented via VS Code native progress API:
    - Informative messages including workspace-relative paths.
    - Notifications automatically dismissed after 5 seconds.

### Enhanced
- Robust configuration options provided in VS Code settings (`otakClipboard.*`) to offer flexibility and control to users based on personal or project-specific preferences.

### Documentation
- Comprehensive README documentation added with detailed usage instructions, features descriptions, extension settings explanations, command lists, screenshots, and clear clipboard output examples.
- Provided clear, structured markdown content examples for better understanding of extension outputs.

### Fixed
- Initial implementation is thoroughly tested manually to ensure stability and functionality across listed features.

---

- For more details, see the [README.md](README.md).
- [License MIT](LICENSE)
- Visit the GitHub repository for further information or issue tracking: [otak-clipboard GitHub](https://github.com/tsuyoshi-otake/otak-clipboard).