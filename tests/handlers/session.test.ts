import { describe, test, expect } from "bun:test"
import { handleSessionCreated, handleSessionIdle, handleSessionError } from "../../src/handlers/session.ts"
import { makeCtx } from "../helpers.ts"
import type { EventSessionCreated, EventSessionIdle, EventSessionError } from "@opencode-ai/sdk"

function makeSessionCreated(sessionID: string, createdAt = 1000): EventSessionCreated {
  return {
    type: "session.created",
    properties: {
      info: {
        id: sessionID,
        projectID: "proj_test",
        directory: "/tmp",
        time: { created: createdAt },
      },
    },
  } as unknown as EventSessionCreated
}

function makeSessionIdle(sessionID: string): EventSessionIdle {
  return { type: "session.idle", properties: { sessionID } } as EventSessionIdle
}

function makeSessionError(sessionID: string, error?: { name: string }): EventSessionError {
  return {
    type: "session.error",
    properties: { sessionID, error },
  } as unknown as EventSessionError
}

describe("handleSessionCreated", () => {
  test("increments session counter", async () => {
    const { ctx, counters } = makeCtx()
    await handleSessionCreated(makeSessionCreated("ses_1"), ctx)
    expect(counters.session.calls).toHaveLength(1)
    const call = counters.session.calls.at(0)!
    expect(call.value).toBe(1)
    expect(call.attrs["session.id"]).toBe("ses_1")
  })

  test("emits session.created log record with correct timestamp", async () => {
    const { ctx, logger } = makeCtx()
    await handleSessionCreated(makeSessionCreated("ses_1", 9999), ctx)
    expect(logger.records).toHaveLength(1)
    const record = logger.records.at(0)!
    expect(record.body).toBe("session.created")
    expect(record.timestamp).toBe(9999)
    expect(record.attributes?.["session.id"]).toBe("ses_1")
  })

  test("calls plugin log", async () => {
    const { ctx, pluginLog } = makeCtx()
    await handleSessionCreated(makeSessionCreated("ses_1"), ctx)
    expect(pluginLog.calls).toHaveLength(1)
    const call = pluginLog.calls.at(0)!
    expect(call.level).toBe("info")
    expect(call.extra?.["sessionID"]).toBe("ses_1")
  })

  test("includes project.id in counter attrs", async () => {
    const { ctx, counters } = makeCtx("proj_abc")
    await handleSessionCreated(makeSessionCreated("ses_1"), ctx)
    expect(counters.session.calls.at(0)!.attrs["project.id"]).toBe("proj_abc")
  })
})

describe("handleSessionIdle", () => {
  test("emits session.idle log record", () => {
    const { ctx, logger } = makeCtx()
    handleSessionIdle(makeSessionIdle("ses_1"), ctx)
    expect(logger.records).toHaveLength(1)
    const record = logger.records.at(0)!
    expect(record.body).toBe("session.idle")
    expect(record.attributes?.["session.id"]).toBe("ses_1")
  })

  test("sweeps pendingPermissions for the session", () => {
    const { ctx } = makeCtx()
    ctx.pendingPermissions.set("perm_1", { type: "tool", title: "Read", sessionID: "ses_1" })
    ctx.pendingPermissions.set("perm_2", { type: "tool", title: "Write", sessionID: "ses_other" })
    handleSessionIdle(makeSessionIdle("ses_1"), ctx)
    expect(ctx.pendingPermissions.has("perm_1")).toBe(false)
    expect(ctx.pendingPermissions.has("perm_2")).toBe(true)
  })

  test("sweeps pendingToolSpans for the session", () => {
    const { ctx } = makeCtx()
    ctx.pendingToolSpans.set("ses_1:call_1", { tool: "bash", sessionID: "ses_1", startMs: 0 })
    ctx.pendingToolSpans.set("ses_other:call_2", { tool: "bash", sessionID: "ses_other", startMs: 0 })
    handleSessionIdle(makeSessionIdle("ses_1"), ctx)
    expect(ctx.pendingToolSpans.has("ses_1:call_1")).toBe(false)
    expect(ctx.pendingToolSpans.has("ses_other:call_2")).toBe(true)
  })
})

describe("handleSessionError", () => {
  test("emits session.error log record", () => {
    const { ctx, logger } = makeCtx()
    handleSessionError(makeSessionError("ses_1", { name: "NetworkError" }), ctx)
    expect(logger.records).toHaveLength(1)
    const record = logger.records.at(0)!
    expect(record.body).toBe("session.error")
    expect(record.attributes?.["error"]).toBe("NetworkError")
  })

  test("defaults sessionID to 'unknown' when undefined", () => {
    const { ctx, logger } = makeCtx()
    handleSessionError({ type: "session.error", properties: {} } as unknown as EventSessionError, ctx)
    expect(logger.records.at(0)!.attributes?.["session.id"]).toBe("unknown")
  })

  test("sweeps pending maps on error", () => {
    const { ctx } = makeCtx()
    ctx.pendingPermissions.set("perm_1", { type: "tool", title: "Read", sessionID: "ses_1" })
    ctx.pendingToolSpans.set("ses_1:call_1", { tool: "bash", sessionID: "ses_1", startMs: 0 })
    handleSessionError(makeSessionError("ses_1"), ctx)
    expect(ctx.pendingPermissions.size).toBe(0)
    expect(ctx.pendingToolSpans.size).toBe(0)
  })
})
