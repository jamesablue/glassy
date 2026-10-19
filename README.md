# Glassy

[![CI](https://github.com/jamesablue/glassy/actions/workflows/ci.yml/badge.svg)](https://github.com/jamesablue/glassy/actions/workflows/ci.yml)

A Windy-style forecast map that ranks Oahu snorkel spots by wind, swell and depth.

> 🚧 **Work in progress:** being rebuilt from a prototype into Angular 22.

## Roadmap

Work is tracked in GitHub Issues, one per phase:

- [Milestones](https://github.com/jamesablue/glassy/milestones): v0.1 Foundation → v0.5 Feature parity → v1.0 Portfolio release
- [Issues](https://github.com/jamesablue/glassy/issues): phase checklists with acceptance criteria
- [Backlog](https://github.com/jamesablue/glassy/issues?q=is%3Aissue+label%3Aroadmap): ideas beyond v1.0

## Quick start

Requires Node 24 (see `.nvmrc`).

```sh
nvm use && npm ci && npm start
```

Then open http://localhost:4200.

| Script                 | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm start`            | Dev server                                |
| `npm run build`        | Production build (base href `/`)          |
| `npm run build:pages`  | GitHub Pages build (base href `/glassy/`) |
| `npm test`             | Unit tests (Vitest), single run           |
| `npm run test:ci`      | Unit tests with coverage                  |
| `npm run lint`         | ESLint, including layer import boundaries |
| `npm run typecheck`    | TypeScript for app, unit and e2e configs  |
| `npm run format:check` | Prettier check                            |
| `npm run e2e`          | Playwright end-to-end tests               |

A full README with architecture, data sources and deployment notes is coming in a later phase.

## License

[MIT](LICENSE) © James Blue
