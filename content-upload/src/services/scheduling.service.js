const { CONTENT_STATUS } = require("../constants");

const isWithinWindow = (content, now) => {
  if (!content.start_time || !content.end_time) {
    return false;
  }

  const start = new Date(content.start_time);
  const end = new Date(content.end_time);
  return start <= now && now < end;
};

const selectActiveContentForSubject = (items, now = new Date()) => {
  const eligible = items
    .filter((item) => item.status === CONTENT_STATUS.APPROVED)
    .filter((item) => item.duration_minutes > 0)
    .filter((item) => isWithinWindow(item, now))
    .sort((a, b) => {
      if (a.rotation_order !== b.rotation_order) {
        return a.rotation_order - b.rotation_order;
      }

      return a.id - b.id;
    });

  if (eligible.length === 0) {
    return null;
  }

  const anchor = eligible
    .map((item) => new Date(item.start_time).getTime())
    .sort((a, b) => a - b)[0];

  const totalDurationMinutes = eligible.reduce(
    (sum, item) => sum + item.duration_minutes,
    0
  );

  const elapsedMinutes = Math.floor((now.getTime() - anchor) / 60000);
  const normalizedMinute =
    ((elapsedMinutes % totalDurationMinutes) + totalDurationMinutes) %
    totalDurationMinutes;

  let cursor = 0;
  for (const item of eligible) {
    cursor += item.duration_minutes;
    if (normalizedMinute < cursor) {
      return item;
    }
  }

  return eligible[eligible.length - 1];
};

const getActiveContentPayload = (rows, now = new Date()) => {
  const grouped = rows.reduce((accumulator, row) => {
    if (!accumulator[row.subject]) {
      accumulator[row.subject] = [];
    }

    accumulator[row.subject].push(row);
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .map(([subject, items]) => {
      const activeItem = selectActiveContentForSubject(items, now);

      if (!activeItem) {
        return null;
      }

      return {
        subject,
        content: activeItem,
      };
    })
    .filter(Boolean);
};

module.exports = {
  isWithinWindow,
  selectActiveContentForSubject,
  getActiveContentPayload,
};

