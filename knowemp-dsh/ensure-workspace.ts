import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-workspace'

/** Cordis plugin name. */
export const name = 'knowemp-workspace'

/** Host workspace registry that stores the cwd project. */
export const inject = ['workspaceRegistry']

/**
 * Create or reuse the durable workspace for `process.cwd()` so a Q&A user
 * lands in one project without an Add-workspace control.
 * @param ctx - host context after `workspaceRegistry` is active
 */
export function apply(ctx: Context): void {
  void ctx.workspaceRegistry.create(process.cwd()).catch((error: unknown) => {
    console.error('[knowemp-workspace] failed to ensure cwd workspace', error)
  })
}
