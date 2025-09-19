# Repository Guidelines

## Project Structure & Module Organization
The extension entry point is `src/extension.ts`, which wires VS Code command registrations to the `CopyCommands` orchestrator in `src/commands/`. Clipboard, file, gitignore, and quota helpers live under `src/utils/`, and shared types should stay nearby. Automated tests reside in `src/test/` and follow the `*.test.ts` suffix. Static assets such as the marketplace icon live in `images/`. TypeScript builds emit to the generated `out/` folder; clean it before committing if you compile locally.

## Build, Test, and Development Commands
Run `npm install` once per clone. Use `npm run watch` for incremental compilation while developing, or `npm run compile` for a one-off build. `npm run lint` executes ESLint on `src/` with the repository rules. `npm test` launches `@vscode/test-cli`; the `pretest` hook compiles and lints first. Package the extension with `npm run vscode:prepublish` before publishing to confirm the emitted artifacts.

## Coding Style & Naming Conventions
TypeScript sources use four-space indentation, semicolons, and strict equality. Preserve the existing command IDs (`otakClipboard.*`) and favor descriptive function names that mirror user-facing actions. ESLint (`eslint.config.mjs`) enforces import naming (`camelCase`/`PascalCase`), curly braces, and no literal throws. Run `npx eslint src --fix` before committing when style adjustments are needed.

## Testing Guidelines
Place new tests next to the code under test inside `src/test/` and name them `<feature>.test.ts`. Prefer Mocha-style suites supplied by `@vscode/test-cli`, and isolate filesystem fixtures under temporary directories to avoid polluting the workspace. Execute `npm test` locally and capture extension logs when diagnosing flaky failures.

## Commit & Pull Request Guidelines
Follow the Conventional Commits pattern visible in history (`feat:`, `chore:`, `docs:`). Keep the summary imperative and under 70 characters, with optional scopes when touching a single area (`feat(commands):`). PRs should describe the user impact, list manual or automated test evidence, link related issues, and attach screenshots or recordings when UX changes affect the command palette or context menus.

## Extension Configuration Tips
Update `package.json` contributes entries and `README.md` together when adding configuration. Highlight defaults such as `otakClipboard.maxCharacters` and `otakClipboard.excludeDirectories`, and ensure new settings remain within the documented limits to keep clipboard copies performant.
