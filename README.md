# opencode-plugin-otel

An [opencode](https://opencode.ai) plugin that exports telemetry via OpenTelemetry (OTLP/gRPC), mirroring the same signals as [Claude Code's monitoring](https://code.claude.com/docs/en/monitoring-usage).

- [What it instruments](#what-it-instruments)
  - [Metrics](#metrics)
  - [Log events](#log-events)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Quick start](#quick-start)
  - [Headers and resource attributes](#headers-and-resource-attributes)
  - [Datadog example](#datadog-example)
  - [Honeycomb example](#honeycomb-example)
  - [Claude Code dashboard compatibility](#claude-code-dashboard-compatibility)
- [Local development](#local-development)

## What it instruments

### Metrics

| Metric | Description |
|--------|-------------|
| `opencode.session.count` | Counter — incremented on each `session.created` event |
| `opencode.token.usage` | Counter — per token type: `input`, `output`, `reasoning`, `cacheRead`, `cacheCreation` |
| `opencode.cost.usage` | Counter — USD cost per completed assistant message |
| `opencode.lines_of_code.count` | Counter — lines added/removed per `session.diff` event |
| `opencode.commit.count` | Counter — git commits detected via bash tool |
| `opencode.tool.duration` | Histogram — tool execution time in milliseconds |

### Log events

| Event | Description |
|-------|-------------|
| `session.created` | Session started |
| `session.idle` | Session went idle |
| `session.error` | Session error |
| `user_prompt` | User sent a message (includes `prompt_length`, `model`, `agent`) |
| `api_request` | Completed assistant message (tokens, cost, duration) |
| `api_error` | Failed assistant message (error summary, duration) |
| `tool_result` | Tool completed or errored (duration, success, output size) |
| `tool_decision` | Permission prompt answered (accept/reject) |
| `commit` | Git commit detected |

## Installation

Add the plugin to your opencode config at `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-plugin-otel"]
}
```

Or point directly at a local checkout for development:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["/path/to/opencode-plugin-otel/src/index.ts"]
}
```

## Configuration

All configuration is via environment variables. Set them in your shell profile (`~/.zshrc`, `~/.bashrc`, etc.).

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCODE_ENABLE_TELEMETRY` | _(unset)_ | Set to any non-empty value to enable the plugin |
| `OPENCODE_OTLP_ENDPOINT` | `http://localhost:4317` | gRPC OTLP collector endpoint |
| `OPENCODE_OTLP_METRICS_INTERVAL` | `60000` | Metrics export interval in milliseconds |
| `OPENCODE_OTLP_LOGS_INTERVAL` | `5000` | Logs export interval in milliseconds |
| `OPENCODE_METRIC_PREFIX` | `opencode.` | Prefix for all metric names (e.g. set to `claude_code.` for Claude Code dashboard compatibility) |
| `OPENCODE_OTLP_HEADERS` | _(unset)_ | Comma-separated `key=value` headers added to all OTLP exports. Example: `api-key=abc123,x-tenant=my-org`. **Keep out of version control — may contain sensitive auth tokens.** |
| `OPENCODE_RESOURCE_ATTRIBUTES` | _(unset)_ | Comma-separated `key=value` pairs merged into the OTel resource. Example: `service.version=1.2.3,deployment.environment=production` |

### Headers and resource attributes

```bash
# Auth token for a managed collector (e.g. Honeycomb, Grafana Cloud)
export OPENCODE_OTLP_HEADERS="x-honeycomb-team=your-api-key,x-honeycomb-dataset=opencode"

# Tag every metric and log with deployment context
export OPENCODE_RESOURCE_ATTRIBUTES="service.version=1.2.3,deployment.environment=production"
```

> **Security note:** `OPENCODE_OTLP_HEADERS` typically contains auth tokens. Set it in your shell profile (`~/.zshrc`, `~/.bashrc`) or a secrets manager — never commit it to version control or print it in CI logs.

### Quick start

```bash
export OPENCODE_ENABLE_TELEMETRY=1
export OPENCODE_OTLP_ENDPOINT=http://localhost:4317
opencode
```

### Datadog example

```bash
export OPENCODE_ENABLE_TELEMETRY=1
export OPENCODE_OTLP_ENDPOINT=https://api.datadoghq.com
```

### Honeycomb example

```bash
export OPENCODE_ENABLE_TELEMETRY=1
export OPENCODE_OTLP_ENDPOINT=https://api.honeycomb.io
```

### Claude Code dashboard compatibility

```bash
export OPENCODE_METRIC_PREFIX=claude_code.
```

## Local development

See [CONTRIBUTING.md](./CONTRIBUTING.md).
