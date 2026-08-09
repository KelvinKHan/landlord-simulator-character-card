const colorRecord = z.record(z.string(), z.string());

const takeoverDirection = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  buildingName: z.string().min(1),
  description: z.string().min(1),
  highlight: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).min(2).max(5),
  theme: z.object({
    主色: z.string().min(1),
    辅色: z.string().min(1),
    纹理: z.string().min(1),
  }),
  opportunities: z.array(z.string().min(1)).min(2).max(5),
});

const renovationPlan = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  style: z.string().min(1),
  tagline: z.string().min(1),
  palette: colorRecord,
  materials: z.record(z.string(), z.string()),
  furniture: z.record(z.string(), z.string()),
  lighting: z.string().min(1),
  atmosphere: z.string().min(1),
  resultDescription: z.string().min(1),
  impacts: z.array(z.string().min(1)).min(2).max(5),
});

const recruitmentCandidate = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  origin: z.string().min(1),
  role: z.string().min(1),
  profession: z.string().min(1),
  appearance: z.string().min(1),
  personality: z.string().min(1),
  firstThought: z.string().min(1),
  collision: z.string().min(1),
  quote: z.string().min(1),
  tags: z.array(z.string().min(1)).min(2).max(5),
  visualIdentity: z.object({
    图标: z.string().min(1),
    主色: z.string().min(1),
    纹样: z.string().min(1),
  }),
});

export const ManagementAiSchemas = Object.freeze({
  takeover: z.object({ directions: z.array(takeoverDirection).length(3) }),
  renovation: z.object({ plans: z.array(renovationPlan).length(3) }),
  recruitment: z.object({ candidates: z.array(recruitmentCandidate).length(3) }),
});

export const ManagementAiJsonSchemas = Object.freeze(
  Object.fromEntries(
    Object.entries(ManagementAiSchemas).map(([kind, schema]) => [kind, z.toJSONSchema(schema)]),
  ),
);
