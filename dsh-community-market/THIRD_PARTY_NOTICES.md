# THIRD_PARTY NOTICES

This package (`@deepseek-ai/dsh-community-market`) depends on the
following third-party packages. All are MIT-licensed unless noted.

## Runtime dependencies (devDependencies in this private package; will
become peerDependencies in the published release)

| Package | Version | License | Source |
|---|---|---|---|
| `@deepseek-ai/cordis` | 4.0.1 | MIT | https://github.com/deepseek-ai/cordis |
| `@deepseek-ai/dsh-host-webserver` | 0.1.0-rc.6 | MIT | https://github.com/deepseek-ai/deepseek-harness |
| `@deepseek-ai/dsh-settings` | 0.1.0-rc.6 | MIT | https://github.com/deepseek-ai/deepseek-harness |
| `@deepseek-ai/dsh-client-runtime` | 0.1.0-rc.6 | MIT | https://github.com/deepseek-ai/deepseek-harness |
| `@deepseek-ai/dsh-client-locale` | 0.1.0-rc.6 | MIT | https://github.com/deepseek-ai/deepseek-harness |
| `@deepseek-ai/dsh-client-ui-slots` | 0.1.0-rc.6 | MIT | https://github.com/deepseek-ai/deepseek-harness |
| `@deepseek-ai/dsh-client-ui-theme` | 0.1.0-rc.6 | MIT | https://github.com/deepseek-ai/deepseek-harness |
| `@deepseek-ai/dsh-typert-protocol` | 0.1.0-rc.6 | MIT | https://github.com/deepseek-ai/deepseek-harness |
| `@deepseek-ai/dsh-typert-registry` | 0.1.0-rc.6 | MIT | https://github.com/deepseek-ai/deepseek-harness |
| `@deepseek-ai/schemastery` | ^3.18.1 | MIT | https://github.com/deepseek-ai/cosmokit |
| `@deepseek-ai/dsh-brand` | 0.1.0-rc.6 | MIT | https://github.com/deepseek-ai/deepseek-harness |
| `@deepseek-ai/dsh-invariants` | 0.1.0-rc.6 | MIT | https://github.com/deepseek-ai/deepseek-harness |

## Build / test dependencies

| Package | Version | License | Source |
|---|---|---|---|
| `ajv` | ^8.17.1 | MIT | https://github.com/ajv-validator/ajv |
| `ajv-formats` | ^3.0.1 | MIT | https://github.com/ajv-validator/ajv-formats |
| `fast-uri` | (transitive of ajv) | BSD-3-Clause | https://github.com/fastify/fast-uri |
| `tsdown` | ^0.22.2 | MIT | https://github.com/rolldown/tsdown |
| `typescript` | ^5.6.3 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| `vitest` | ^2.1.8 | MIT | https://github.com/vitest-dev/vitest |
| `react` | 18.3.1 | MIT | https://github.com/facebook/react |
| `react-dom` | 18.3.1 | MIT | https://github.com/facebook/react |
| `@types/node` | ^22.20.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| `@types/react` | ^18.3.12 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| `unrun` | ^0.3.1 | MIT | https://github.com/Jarred-Sumner/unrun |

## Transitive dependencies (most relevant)

- `cosmokit` (MIT) — utility toolkit, used by schemastery and the upstream
  DSH runtime
- `fast-deep-equal` (MIT) — used by ajv
- `json-schema-traverse` (MIT) — used by ajv
- `@standard-schema/spec` (MIT) — used by upstream DSH services

## Acknowledgements

- The DSH Cordis plugin contract follows the pattern documented in
  [`docs/plugin-development.md`](docs/plugin-development.md) of the parent
  `deepseek-harness-desktop` monorepo.
- The 1024Store partner response shape used in tests is fictional; the
  real wire shape will be pinned at integration time against the
  upstream partner's actual response.
- The threat model in `docs/threat-model.md` is the source of truth for
  the install-time guarantees.