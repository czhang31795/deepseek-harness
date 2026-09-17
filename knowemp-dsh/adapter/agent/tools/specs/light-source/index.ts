import { buildToolDescription, type OpenAiToolDefinition, type ToolContract } from '../../tool.types';
import { GET_HOST_RECOMMEND_INFO_CONTRACT } from './get-host-recommend-info.contract';
import { GET_LIGHT_SOURCE_APPLICATION_CASES_CONTRACT } from './get-light-source-application-cases.contract';
import { GET_LIGHT_SOURCE_FILTERS_CONTRACT } from './get-light-source-filters.contract';
import { GET_LIGHT_SOURCE_P2P_CONTRACT } from './get-light-source-p2p.contract';
import { SEARCH_LIGHT_SOURCES_CONTRACT } from './search-light-sources.contract';

/** 光学光源库 5 个只读 Tool 契约。已注册到 ToolRegistry。 */
export const LIGHT_SOURCE_TOOL_CONTRACTS: ToolContract[] = [
  GET_LIGHT_SOURCE_FILTERS_CONTRACT,
  SEARCH_LIGHT_SOURCES_CONTRACT,
  GET_LIGHT_SOURCE_P2P_CONTRACT,
  GET_LIGHT_SOURCE_APPLICATION_CASES_CONTRACT,
  GET_HOST_RECOMMEND_INFO_CONTRACT,
];

export function toLightSourceOpenAiTools(
  contracts: ToolContract[] = LIGHT_SOURCE_TOOL_CONTRACTS,
): OpenAiToolDefinition[] {
  return contracts.map((contract) => ({
    type: 'function',
    function: {
      name: contract.name,
      description: buildToolDescription({
        description: contract.summary,
        returns: contract.returns,
        notes: contract.notes,
        upstream: contract.upstream,
      }),
      parameters: contract.parameters,
    },
  }));
}

export {
  GET_HOST_RECOMMEND_INFO_CONTRACT,
  GET_LIGHT_SOURCE_APPLICATION_CASES_CONTRACT,
  GET_LIGHT_SOURCE_FILTERS_CONTRACT,
  GET_LIGHT_SOURCE_P2P_CONTRACT,
  SEARCH_LIGHT_SOURCES_CONTRACT,
};
