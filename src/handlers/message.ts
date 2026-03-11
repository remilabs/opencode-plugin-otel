import { SeverityNumber } from "@opentelemetry/api-logs"
import type { AssistantMessage, EventMessageUpdated, EventMessagePartUpdated, ToolPart } from "@opencode-ai/sdk"
import { errorSummary } from "../util.ts"
import { setBoundedMap } from "../util.ts"
import type { HandlerContext } from "../types.ts"

/**
 * Handles a completed assistant message: increments token and cost counters and emits
 * either an `api_request` or `api_error` log event depending on whether the message errored.
 */
export function handleMessageUpdated(e: EventMessageUpdated, ctx: HandlerContext) {
  const msg = e.properties.info
  if (msg.role !== "assistant") return
  const assistant = msg as AssistantMessage
  if (!assistant.time.completed) return

  const { sessionID, modelID, providerID } = assistant
  const duration = assistant.time.completed - assistant.time.created
  const { tokenCounter, costCounter } = ctx.instruments

  tokenCounter.add(assistant.tokens.input, { ...ctx.commonAttrs, "session.id": sessionID, model: modelID, type: "input" })
  tokenCounter.add(assistant.tokens.output, { ...ctx.commonAttrs, "session.id": sessionID, model: modelID, type: "output" })
  tokenCounter.add(assistant.tokens.reasoning, { ...ctx.commonAttrs, "session.id": sessionID, model: modelID, type: "reasoning" })
  tokenCounter.add(assistant.tokens.cache.read, { ...ctx.commonAttrs, "session.id": sessionID, model: modelID, type: "cacheRead" })
  tokenCounter.add(assistant.tokens.cache.write, { ...ctx.commonAttrs, "session.id": sessionID, model: modelID, type: "cacheCreation" })
  costCounter.add(assistant.cost, { ...ctx.commonAttrs, "session.id": sessionID, model: modelID })

  if (assistant.error) {
    ctx.logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      timestamp: assistant.time.created,
      observedTimestamp: Date.now(),
      body: "api_error",
      attributes: {
        "event.name": "api_error",
        "session.id": sessionID,
        model: modelID,
        provider: providerID,
        error: errorSummary(assistant.error),
        duration_ms: duration,
        ...ctx.commonAttrs,
      },
    })
    return ctx.log("error", "otel: api_error", {
      sessionID,
      model: modelID,
      error: errorSummary(assistant.error),
      duration_ms: duration,
    })
  }

  ctx.logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: "INFO",
    timestamp: assistant.time.created,
    observedTimestamp: Date.now(),
    body: "api_request",
    attributes: {
      "event.name": "api_request",
      "session.id": sessionID,
      model: modelID,
      provider: providerID,
      cost_usd: assistant.cost,
      duration_ms: duration,
      input_tokens: assistant.tokens.input,
      output_tokens: assistant.tokens.output,
      reasoning_tokens: assistant.tokens.reasoning,
      cache_read_tokens: assistant.tokens.cache.read,
      cache_creation_tokens: assistant.tokens.cache.write,
      ...ctx.commonAttrs,
    },
  })
  return ctx.log("info", "otel: api_request", {
    sessionID,
    model: modelID,
    cost_usd: assistant.cost,
    duration_ms: duration,
    input_tokens: assistant.tokens.input,
    output_tokens: assistant.tokens.output,
  })
}

/**
 * Tracks tool execution time between `running` and `completed`/`error` part updates,
 * records a `tool.duration` histogram measurement, and emits a `tool_result` log event.
 */
export function handleMessagePartUpdated(e: EventMessagePartUpdated, ctx: HandlerContext) {
  const part = e.properties.part
  if (part.type !== "tool") return

  const toolPart = part as ToolPart
  const key = `${toolPart.sessionID}:${toolPart.callID}`

  if (toolPart.state.status === "running") {
    setBoundedMap(ctx.pendingToolSpans, key, {
      tool: toolPart.tool,
      sessionID: toolPart.sessionID,
      startMs: toolPart.state.time.start,
    })
    return
  }

  if (toolPart.state.status !== "completed" && toolPart.state.status !== "error") return

  const span = ctx.pendingToolSpans.get(key)
  ctx.pendingToolSpans.delete(key)
  const start = span?.startMs ?? toolPart.state.time.start
  const end = toolPart.state.time.end
  if (end === undefined) return
  const duration_ms = end - start
  const success = toolPart.state.status === "completed"

  ctx.instruments.toolDurationHistogram.record(duration_ms, {
    ...ctx.commonAttrs,
    "session.id": toolPart.sessionID,
    tool_name: toolPart.tool,
    success,
  })

  const sizeAttr = success
    ? { tool_result_size_bytes: Buffer.byteLength((toolPart.state as { output: string }).output, "utf8") }
    : { error: (toolPart.state as { error: string }).error }

  ctx.logger.emit({
    severityNumber: success ? SeverityNumber.INFO : SeverityNumber.ERROR,
    severityText: success ? "INFO" : "ERROR",
    timestamp: start,
    observedTimestamp: Date.now(),
    body: "tool_result",
    attributes: {
      "event.name": "tool_result",
      "session.id": toolPart.sessionID,
      tool_name: toolPart.tool,
      success,
      duration_ms,
      ...sizeAttr,
      ...ctx.commonAttrs,
    },
  })
  return ctx.log(success ? "info" : "error", "otel: tool_result", {
    sessionID: toolPart.sessionID,
    tool_name: toolPart.tool,
    success,
    duration_ms,
  })
}
