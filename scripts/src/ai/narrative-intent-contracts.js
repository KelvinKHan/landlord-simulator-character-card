const spatialIntent = z.object({
  personId: z.string().min(1),
  buildingId: z.string().min(1),
  spaceId: z.string().min(1),
  activity: z.string().min(1).max(80),
});

export const NarrativeIntentSchema = z.object({
  intents: z.array(spatialIntent).max(12),
  unresolved: z.array(z.string().min(1)).max(12).prefault([]),
});

export const NarrativeIntentJsonSchema = z.toJSONSchema(NarrativeIntentSchema);
