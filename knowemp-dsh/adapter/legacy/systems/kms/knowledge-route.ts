import { extractLeavePolicyTerms } from './knowledge-query.rewrite';

/** 传给 Aily 技能开始节点自定义变量，名称必须与画布里一致。 */
export const AILY_STANDARD_INPUT_KEY = 'is_standard';

export type KnowledgeRoute = 'standard' | 'other' | 'unsure';

/** 制度规范库、生产知识库等，名称不是「xxx标准」→ is_standard=false。 */
export const KMS_POLICY_RE = /(企业文化|管理制度|行政管理)/;

const KMS_ADMIN_LEAVE_RE =
  /(出差报销|差旅费报销|差旅报销|市内交通报销|请假|年假|年休假|工龄|入职手续|考勤)/;

/** 星宇内部技术要求，知识空间名称多为 xxx标准 → is_standard=true。 */
export const KMS_XINGYU_STANDARD_RE =
  /(项目管理|产品设计|电子开发|工艺技术|装备模具|模具开发|创新研究|竞品分析|设计.{0,32}(模块|模组|电路)|(?:模块|模组).{0,20}(设计|参考)|设计规范|参考资料)/;

/** 橡胶条等工艺标准里的辅料（如 3M 胶带），走「xxx标准」库。 */
export const KMS_PROCESS_TAPE_RE =
  /橡胶条.{0,40}(胶带|3M)|(?:3M胶带|胶带).{0,40}橡胶条/;

/** 主机厂 / 国际 / 国家 / 行业等外部技术要求 → is_standard=true。 */
export const KMS_OEM_STANDARD_RE =
  /(主机厂|整车厂|\bOEM\b).{0,20}(标准|技术要求|试验|技术条款|准入|合规)/i;

export const KNOWLEDGE_ROUTE_PROMPT = `你是知识库路由分类器。判断用户问题要检索哪类知识空间。飞书只有两路，按知识空间名称划分。

standard（名称多为「xxx标准」）：①星宇内部技术要求：项目管理、产品设计、电子开发、工艺技术管理、装备模具开发、创新研究、竞品分析；问某模块/模组怎么设计、有没有参考资料也选 standard。②外部技术要求：主机厂、国际、国家、行业对车灯的技术标准、试验规范、合规准入。③点名某份「xxx标准」（如橡胶条标准）以及该标准里推荐的胶带、辅料、型号。有标准号（GB、GB/T、ISO、ASTM、IEC、DIN、XYN、Q/xxx），或写了国家标准/国际标准/行业标准/企业标准/企标，也选 standard。
other（制度规范库、生产知识库等）：企业文化、管理制度、报销、年假、护理假等休假、工龄、请假、行政流程；以及具体产品或项目的试验失效、开裂、整改、对策、经验总结、作业指导、试模。句子里即使有「试验」「酒精」「耐醇」「拉脱力」，只要在讲某盏灯/某个零件出了什么问题，也选 other。出差报销、年假即便带「标准」二字也选 other。
unsure：只问指标或试验方法，既没有标准号/技术标准线索，也没有制度或生产经验/开裂/整改线索。不要猜。不要因为出现「试验」「酒精」「耐醇」就判 standard。
若提供了当前话题，短追问按话题所属类别判断，不要只因本句没写标准号就选 unsure。

只输出 JSON，不要解释。例如：
{"route":"standard"}
{"route":"other"}
{"route":"unsure"}`;

/** 高置信才短路；其余交给模型。空问题走其它库。 */
export function heuristicIsStandard(query: string): boolean | undefined {
  const q = query.trim();
  if (!q) return false;
  if (
    /(国家标准|国际标准|行业标准|企业标准|企标|国标|GB\/T|GB\/Z|\bGB[\s\-]?\d|ISO\s*\d|ASTM|IEC\s*\d|DIN\s*\d|JIS\s*[A-Z]?\s*\d|SAE\s*[A-Z]?\s*\d|\bXYN\s*[-/]?\s*\d{4,}|\bQ\s*\/\s*[A-Za-z0-9]+)/i.test(
      q,
    )
  ) {
    return true;
  }
  if (KMS_OEM_STANDARD_RE.test(q)) {
    return true;
  }
  if (KMS_ADMIN_LEAVE_RE.test(q)) {
    return false;
  }
  if (extractLeavePolicyTerms(q).length) {
    return false;
  }
  if (KMS_POLICY_RE.test(q)) {
    return false;
  }
  if (KMS_XINGYU_STANDARD_RE.test(q)) {
    return true;
  }
  if (KMS_PROCESS_TAPE_RE.test(q)) {
    return true;
  }
  if (
    /(整改对策|经验总结|作业指导|试模经验|失效分析|问题总结|开裂)/.test(q)
  ) {
    return false;
  }
  if (looksLikeNamedStandardDoc(q)) {
    return true;
  }
  return undefined;
}

/** 分类器拿不准且召回为空时，自动改搜另一路。用户点选的路由不翻转。 */
export function shouldRetryOtherKnowledgeRoute(input: {
  userSpecified: boolean;
  heuristic?: boolean;
  chunkCount: number;
}): boolean {
  return (
    !input.userSpecified &&
    input.heuristic === undefined &&
    input.chunkCount === 0
  );
}

/** 点名某份「xxx标准」或「这个标准」，且不是报销/物料测试标准。 */
export function looksLikeNamedStandardDoc(query: string): boolean {
  const q = query.trim();
  if (!q.includes('标准')) return false;
  if (KMS_ADMIN_LEAVE_RE.test(q) || extractLeavePolicyTerms(q).length) {
    return false;
  }
  if (
    /(测试标准|试验标准|检测标准)/.test(q) &&
    /(料|物料|材料)/.test(q)
  ) {
    return false;
  }
  return /(这个标准|该标准|本标准|上述标准|标准里面|标准里|标准中)|(?:[\u4e00-\u9fffA-Za-z0-9]{1,20}标准)/.test(
    q,
  );
}

export function parseKnowledgeRoute(raw: string): KnowledgeRoute | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  try {
    const rec = JSON.parse(jsonText) as {
      route?: unknown;
      is_standard?: unknown;
    };
    const route = String(rec.route ?? '')
      .trim()
      .toLowerCase();
    if (route === 'standard' || route === 'other' || route === 'unsure') {
      return route;
    }
    if (rec.is_standard === true) return 'standard';
    if (rec.is_standard === false) return 'other';
    if (rec.is_standard === null) return 'unsure';
  } catch {
    // fall through
  }
  if (/\bunsure\b/i.test(text)) return 'unsure';
  const flag = parseIsStandard(text);
  if (flag === true) return 'standard';
  if (flag === false) return 'other';
  return undefined;
}

export function parseIsStandard(raw: string): boolean | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  try {
    const rec = JSON.parse(jsonText) as { is_standard?: unknown };
    if (typeof rec.is_standard === 'boolean') return rec.is_standard;
    if (rec.is_standard === 'true' || rec.is_standard === 1) return true;
    if (rec.is_standard === 'false' || rec.is_standard === 0) return false;
  } catch {
    // fall through
  }
  if (/\bis_standard\s*[:=]\s*true\b/i.test(text)) return true;
  if (/\bis_standard\s*[:=]\s*false\b/i.test(text)) return false;
  return undefined;
}

export function ailySkillStartBody(query: string, isStandard: boolean) {
  return {
    global_variable: { query: query.slice(0, 40960) },
    input: JSON.stringify({ [AILY_STANDARD_INPUT_KEY]: isStandard }),
  };
}
