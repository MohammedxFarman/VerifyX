import { z } from "zod";

export const checkSchema = z.object({
  status: z.enum([
    "completed",
    "unavailable",
    "unsupported",
    "failed",
    "inconclusive",
  ]),
  method: z.string(),
  findings: z.array(z.string()),
  score: z.number().min(0).max(1).nullable().default(null),
  scoreMeaning: z.string().optional(),
  measurements: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
  localizationAvailable: z.boolean().optional(),
});
export const reportSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  kind: z.enum([
    "image",
    "news",
    "website",
    "profile",
    "plagiarism",
    "ai-content",
  ]),
  status: z.enum(["completed", "partial", "unavailable", "inconclusive"]),
  assessment: z.enum(["inconclusive", "evidence_available", "potential_risk"]),
  summary: z.string(),
  createdAt: z.string(),
  analysis: z.record(z.string(), checkSchema),
  sources: z.array(
    z.object({
      title: z.string(),
      url: z.string().url(),
      excerpt: z.string(),
      retrieval: z.enum(["retrieved", "search_snippet", "failed"]),
    }),
  ),
  limitations: z.array(z.string()),
});
export type EvidenceReport = z.infer<typeof reportSchema>;
export type Check = z.infer<typeof checkSchema>;
export const jobSchema = z.object({
  job_id: z.string(),
  status: z.enum(["queued", "processing", "completed", "failed", "canceled"]),
  report: reportSchema.optional(),
  error: z.string().optional(),
});
export type JobResponse = z.infer<typeof jobSchema>;
