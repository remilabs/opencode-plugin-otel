import { describe, test, expect } from "bun:test"
import { probeEndpoint } from "../src/probe.ts"

describe("probeEndpoint", () => {
  test("returns error for malformed URL (no scheme)", async () => {
    const result = await probeEndpoint("localhost:4317")
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })

  test("returns error for completely invalid URL", async () => {
    const result = await probeEndpoint("not a url at all")
    expect(result.ok).toBe(false)
    expect(result.error).toContain("invalid endpoint URL")
  })

  test("returns error when nothing is listening on the port", async () => {
    const result = await probeEndpoint("http://127.0.0.1:19999")
    expect(result.ok).toBe(false)
    expect(result.ms).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeDefined()
  })

  test("returns ok when port is open", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("ok") })
    const port = server.port
    try {
      const result = await probeEndpoint(`http://127.0.0.1:${port}`)
      expect(result.ok).toBe(true)
      expect(result.ms).toBeGreaterThanOrEqual(0)
      expect(result.error).toBeUndefined()
    } finally {
      server.stop()
    }
  })
})
