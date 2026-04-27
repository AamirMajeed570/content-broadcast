const {
  uploadContentSchema,
  updateScheduleSchema,
} = require("../src/validators/content.validator");

describe("content.validator", () => {
  test("accepts multipart upload numeric fields sent as strings", () => {
    const parsed = uploadContentSchema.safeParse({
      title: "Math Practice Set",
      subject: "maths",
      description: "Chapter 5 worksheet",
      start_time: "2026-04-27T09:00:00.000Z",
      end_time: "2026-04-27T11:00:00.000Z",
      rotation_duration_minutes: "5",
      rotation_order: "1",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data.rotation_duration_minutes).toBe(5);
  });

  test("accepts schedule update duration sent as a string", () => {
    const parsed = updateScheduleSchema.safeParse({
      start_time: "2026-04-27T09:00:00.000Z",
      end_time: "2026-04-27T11:00:00.000Z",
      rotation_duration_minutes: "10",
      rotation_order: "2",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data.rotation_duration_minutes).toBe(10);
  });
});
