import type { RequestContext } from '../../../common/types/request-context';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { ANALYZE_MATERIAL_FILE_CHART_CONTRACT } from '../specs/material/analyze-material-file-chart.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

export class AnalyzeMaterialFileChartTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = ANALYZE_MATERIAL_FILE_CHART_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(
      ANALYZE_MATERIAL_FILE_CHART_CONTRACT,
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
    return this.legacy.analyzeMaterialFileChart({
      materialCode: String(input.materialCode ?? '').trim(),
      fileId: String(input.fileId ?? '').trim(),
      ctx: ctx ?? {},
    });
  }
}
