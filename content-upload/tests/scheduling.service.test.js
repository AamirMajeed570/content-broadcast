const {
  isWithinWindow,
  selectActiveContentForSubject,
  getActiveContentPayload,
} = require("../src/services/scheduling.service");

const buildContent = (overrides = {}) => ({
  id: 1,
  title: "Content",
  subject: "maths",
  status: "approved",
  duration_minutes: 5,
  rotation_order: 1,
  start_time: "2026-04-26T10:00:00.000Z",
  end_time: "2026-04-26T11:00:00.000Z",
  ...overrides,
});

describe("scheduling.service", () => {
  test("treats content without both schedule timestamps as inactive", () => {
    expect(
      isWithinWindow(
        buildContent({ start_time: null, end_time: null }),
        new Date("2026-04-26T10:10:00.000Z")
      )
    ).toBe(false);
  });

  test("rotates approved content using duration and order", () => {
    const now = new Date("2026-04-26T10:06:00.000Z");
    const content = selectActiveContentForSubject(
      [
        buildContent({ id: 1, title: "A", rotation_order: 1, duration_minutes: 5 }),
        buildContent({ id: 2, title: "B", rotation_order: 2, duration_minutes: 5 }),
        buildContent({ id: 3, title: "C", rotation_order: 3, duration_minutes: 5 }),
      ],
      now
    );

    expect(content.title).toBe("B");
  });

  test("ignores pending or unscheduled content", () => {
    const now = new Date("2026-04-26T10:06:00.000Z");
    const content = selectActiveContentForSubject(
      [
        buildContent({ id: 1, title: "Pending", status: "pending" }),
        buildContent({ id: 2, title: "No Window", start_time: null, end_time: null }),
      ],
      now
    );

    expect(content).toBeNull();
  });

  test("returns one active item per subject", () => {
    const now = new Date("2026-04-26T10:06:00.000Z");
    const payload = getActiveContentPayload(
      [
        buildContent({ id: 1, title: "Maths A", subject: "maths" }),
        buildContent({
          id: 2,
          title: "Science A",
          subject: "science",
          start_time: "2026-04-26T10:00:00.000Z",
          end_time: "2026-04-26T12:00:00.000Z",
        }),
      ],
      now
    );

    expect(payload).toHaveLength(2);
    expect(payload.map((item) => item.subject).sort()).toEqual(["maths", "science"]);
  });

  test("loops continuously when elapsed time exceeds one full rotation", () => {
    const now = new Date("2026-04-26T10:17:00.000Z");
    const content = selectActiveContentForSubject(
      [
        buildContent({ id: 1, title: "A", rotation_order: 1, duration_minutes: 5 }),
        buildContent({ id: 2, title: "B", rotation_order: 2, duration_minutes: 5 }),
        buildContent({ id: 3, title: "C", rotation_order: 3, duration_minutes: 5 }),
      ],
      now
    );

    expect(content.title).toBe("A");
  });
});

