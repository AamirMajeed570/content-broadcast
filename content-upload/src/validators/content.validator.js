const { z } = require("zod");

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalPositiveNumberLike = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    return Number(trimmed);
  }

  return value;
}, z.number().positive().optional());

const uploadContentSchema = z.object({
  title: z.string().trim().min(1).max(255),
  subject: z.string().trim().min(1).max(100),
  description: optionalString,
  start_time: optionalString,
  end_time: optionalString,
  rotation_duration_minutes: optionalPositiveNumberLike,
  rotation_order: optionalString,
});

const updateScheduleSchema = z.object({
  start_time: z.string().trim().min(1),
  end_time: z.string().trim().min(1),
  rotation_duration_minutes: optionalPositiveNumberLike,
  rotation_order: optionalString,
});

const decisionSchema = z.object({
  rejection_reason: optionalString,
});

module.exports = {
  uploadContentSchema,
  updateScheduleSchema,
  decisionSchema,
};
