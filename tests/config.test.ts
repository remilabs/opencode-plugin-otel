import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { parseEnvInt, loadConfig, resolveLogLevel } from "../src/config.ts"

describe("parseEnvInt", () => {
  test("returns fallback when env var is unset", () => {
    delete process.env["TEST_INT"]
    expect(parseEnvInt("TEST_INT", 42)).toBe(42)
  })

  test("parses a valid positive integer", () => {
    process.env["TEST_INT"] = "1000"
    expect(parseEnvInt("TEST_INT", 42)).toBe(1000)
  })

  test("returns fallback for non-numeric value", () => {
    process.env["TEST_INT"] = "fast"
    expect(parseEnvInt("TEST_INT", 42)).toBe(42)
  })

  test("returns fallback for zero", () => {
    process.env["TEST_INT"] = "0"
    expect(parseEnvInt("TEST_INT", 42)).toBe(42)
  })

  test("returns fallback for negative value", () => {
    process.env["TEST_INT"] = "-5"
    expect(parseEnvInt("TEST_INT", 42)).toBe(42)
  })

  test("returns fallback for float string", () => {
    process.env["TEST_INT"] = "1.5"
    expect(parseEnvInt("TEST_INT", 42)).toBe(1)
  })

  afterEach(() => { delete process.env["TEST_INT"] })
})

describe("loadConfig", () => {
  const vars = [
    "OPENCODE_ENABLE_TELEMETRY",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_METRIC_EXPORT_INTERVAL",
    "OTEL_LOGS_EXPORT_INTERVAL",
  ]
  beforeEach(() => vars.forEach((k) => delete process.env[k]))
  afterEach(() => vars.forEach((k) => delete process.env[k]))

  test("defaults when no env vars set", () => {
    const cfg = loadConfig()
    expect(cfg.enabled).toBe(false)
    expect(cfg.endpoint).toBe("http://localhost:4317")
    expect(cfg.metricsInterval).toBe(60000)
    expect(cfg.logsInterval).toBe(5000)
  })

  test("enabled when OPENCODE_ENABLE_TELEMETRY is set", () => {
    process.env["OPENCODE_ENABLE_TELEMETRY"] = "1"
    expect(loadConfig().enabled).toBe(true)
  })

  test("reads custom endpoint", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://collector:4317"
    expect(loadConfig().endpoint).toBe("http://collector:4317")
  })

  test("reads custom intervals", () => {
    process.env["OTEL_METRIC_EXPORT_INTERVAL"] = "30000"
    process.env["OTEL_LOGS_EXPORT_INTERVAL"] = "2000"
    const cfg = loadConfig()
    expect(cfg.metricsInterval).toBe(30000)
    expect(cfg.logsInterval).toBe(2000)
  })

  test("falls back to defaults for invalid interval values", () => {
    process.env["OTEL_METRIC_EXPORT_INTERVAL"] = "notanumber"
    process.env["OTEL_LOGS_EXPORT_INTERVAL"] = "0"
    const cfg = loadConfig()
    expect(cfg.metricsInterval).toBe(60000)
    expect(cfg.logsInterval).toBe(5000)
  })
})

describe("resolveLogLevel", () => {
  test("resolves known level (uppercase input)", () => {
    expect(resolveLogLevel("DEBUG", "info")).toBe("debug")
    expect(resolveLogLevel("WARN", "info")).toBe("warn")
    expect(resolveLogLevel("ERROR", "info")).toBe("error")
  })

  test("resolves known level (lowercase input)", () => {
    expect(resolveLogLevel("debug", "info")).toBe("debug")
  })

  test("returns current level for unknown value", () => {
    expect(resolveLogLevel("verbose", "info")).toBe("info")
    expect(resolveLogLevel("", "warn")).toBe("warn")
  })
})
