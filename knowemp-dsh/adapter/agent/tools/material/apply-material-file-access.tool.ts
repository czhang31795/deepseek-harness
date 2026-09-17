import type { RequestContext } from '../../../common/types/request-context';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { APPLY_MATERIAL_FILE_ACCESS_CONTRACT } from '../specs/material/apply-material-file-access.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

export class ApplyMaterialFileAccessTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = APPLY_MATERIAL_FILE_ACCESS_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(
      APPLY_MATERIAL_FILE_ACCESS_CONTRACT,
      (input, ctx) => this.run(input, ctx),
    );
    this.name = base.name;
    this.description = base.description;
    this.parameters = base.parameters;
    this.returns = base.returns;
    this.notes = base.notes;
  }

  execute(input: Record<string, unknown>, ctx?: RequestContext): Promise<unknown> {
    return this.run(input, ctx);
  }

  private run(
    input: Record<string, unknown>,
    ctx?: RequestContext,
  ): Promise<unknown> {
    return this.legacy.applyMaterialFileAccess({
      materialCode: String(input.materialCode ?? '').trim(),
      fileId: String(input.fileId ?? '').trim(),
      access: input.access === 'download' ? 'download' : 'view',
      reason: asTrimmed(input.reason),
      ctx: ctx ?? {},
    });
  }
}

function asTrimmed(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}
