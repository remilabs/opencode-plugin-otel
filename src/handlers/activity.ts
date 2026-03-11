import { SeverityNumber } from "@opentelemetry/api-logs"
import type { EventSessionDiff, EventCommandExecuted } from "@opencode-ai/sdk"
import type { HandlerContext } from "../types.ts"

/** Records lines-added and lines-removed metrics for each file in the diff. */
export function handleSessionDiff(e: EventSessionDiff, ctx: HandlerContext) {
  const sessionID = e.properties.sessionID
  for (const fileDiff of e.properties.diff) {
    if (fileDiff.additions > 0) {
      ctx.instruments.linesCounter.add(fileDiff.additions, {
        ...ctx.commonAttrs,
        "session.id": sessionID,
        type: "added",
      })
    }
    if (fileDiff.deletions > 0) {
      ctx.instruments.linesCounter.add(fileDiff.deletions, {
        ...ctx.commonAttrs,
        "session.id": sessionID,
        type: "removed",
      })
    }
  }
}

const GIT_COMMIT_RE = /\bgit\s+commit(?![-\w])/

/** Detects `git commit` invocations in bash tool calls and increments the commit counter and emits a `commit` log event. */
export function handleCommandExecuted(e: EventCommandExecuted, ctx: HandlerContext) {
  if (e.properties.name !== "bash") return
  if (!GIT_COMMIT_RE.test(e.properties.arguments)) return

  ctx.instruments.commitCounter.add(1, {
    ...ctx.commonAttrs,
    "session.id": e.properties.sessionID,
  })
  ctx.logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: "INFO",
    timestamp: Date.now(),
    observedTimestamp: Date.now(),
    body: "commit",
    attributes: {
      "event.name": "commit",
      "session.id": e.properties.sessionID,
      ...ctx.commonAttrs,
    },
  })
}
