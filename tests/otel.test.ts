import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { parseHeaders, buildResource } from "../src/otel.ts"

describe("parseHeaders", () => {
  test("returns empty object for undefined", () => {
    expect(parseHeaders(undefined)).toEqual({})
  })

  test("returns empty object for empty string", () => {
    expect(parseHeaders("")).toEqual({})
  })

  test("parses a single key=value pair", () => {
    expect(parseHeaders("api-key=abc123")).toEqual({ "api-key": "abc123" })
  })

  test("parses multiple comma-separated pairs", () => {
    expect(parseHeaders("api-key=abc,x-tenant=foo")).toEqual({
      "api-key": "abc",
      "x-tenant": "foo",
    })
  })

  test("trims whitespace around keys and values", () => {
    expect(parseHeaders(" api-key = abc123 ")).toEqual({ "api-key": "abc123" })
  })

  test("ignores pairs with no = sign", () => {
    expect(parseHeaders("no-equals,api-key=abc")).toEqual({ "api-key": "abc" })
  })

  test("handles values containing = signs", () => {
    expect(parseHeaders("token=abc=def")).toEqual({ token: "abc=def" })
  })
})

describe("buildResource", () => {
  const originalEnv = process.env["OTEL_RESOURCE_ATTRIBUTES"]
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["OTEL_RESOURCE_ATTRIBUTES"]
    } else {
      process.env["OTEL_RESOURCE_ATTRIBUTES"] = originalEnv
    }
  })

  test("includes service.name, app.version, os.type, host.arch", () => {
    delete process.env["OTEL_RESOURCE_ATTRIBUTES"]
    const resource = buildResource("1.2.3")
    const attrs = resource.attributes
    expect(attrs["service.name"]).toBe("opencode")
    expect(attrs["app.version"]).toBe("1.2.3")
    expect(attrs["os.type"]).toBe(process.platform)
    expect(attrs["host.arch"]).toBe(process.arch)
  })

  test("merges OTEL_RESOURCE_ATTRIBUTES from env", () => {
    process.env["OTEL_RESOURCE_ATTRIBUTES"] = "team=platform,env=prod"
    const resource = buildResource("0.0.1")
    const attrs = resource.attributes
    expect(attrs["team"]).toBe("platform")
    expect(attrs["env"]).toBe("prod")
  })

  test("trims whitespace in resource attributes", () => {
    process.env["OTEL_RESOURCE_ATTRIBUTES"] = " team = platform "
    const resource = buildResource("0.0.1")
    expect(resource.attributes["team"]).toBe("platform")
  })

  test("env resource attributes override defaults", () => {
    process.env["OTEL_RESOURCE_ATTRIBUTES"] = "service.name=my-override"
    const resource = buildResource("0.0.1")
    expect(resource.attributes["service.name"]).toBe("my-override")
  })
})
