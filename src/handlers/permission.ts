import { SeverityNumber } from "@opentelemetry/api-logs"
import type { EventPermissionUpdated, EventPermissionReplied } from "@opencode-ai/sdk"
import { setBoundedMap } from "../util.ts"
import type { HandlerContext } from "../types.ts"

/** Stores a pending permission prompt in the context map for later correlation with its reply. */
export function handlePermissionUpdated(e: EventPermissionUpdated, ctx: HandlerContext) {
  const perm = e.properties
  setBoundedMap(ctx.pendingPermissions, perm.id, {
    type: perm.type,
    title: perm.title,
    sessionID: perm.sessionID,
  })
}

/** Emits a `tool_decision` log event recording whether the permission was accepted or rejected. */
export function handlePermissionReplied(e: EventPermissionReplied, ctx: HandlerContext) {
  const { permissionID, sessionID, response } = e.properties
  const pending = ctx.pendingPermissions.get(permissionID)
  ctx.pendingPermissions.delete(permissionID)
  const decision = response === "allow" || response === "allowAlways" ? "accept" : "reject"
  ctx.logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: "INFO",
    timestamp: Date.now(),
    observedTimestamp: Date.now(),
    body: "tool_decision",
    attributes: {
      "event.name": "tool_decision",
      "session.id": sessionID,
      tool_name: pending?.title ?? "unknown",
      tool_type: pending?.type ?? "unknown",
      decision,
      source: response,
      ...ctx.commonAttrs,
    },
  })
}
