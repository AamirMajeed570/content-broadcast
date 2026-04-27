const { query, withTransaction } = require("../config/db");
const { CONTENT_STATUS, ROLES } = require("../constants");
const { env } = require("../config/env");
const { ApiError } = require("../utils/api-error");
const { buildPublicFileUrl } = require("../utils/file");
const { getPagination } = require("../utils/pagination");
const { getActiveContentPayload } = require("./scheduling.service");

const parseOptionalDate = (value, fieldName) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `${fieldName} must be a valid ISO datetime`);
  }

  return parsed;
};

const parsePositiveInteger = (value, fieldName, fallback = null) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer`);
  }

  return parsed;
};

const getOrCreateSlot = async (client, subject) => {
  const existing = await client.query(
    "SELECT id, subject FROM content_slots WHERE subject = $1",
    [subject]
  );

  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  const created = await client.query(
    "INSERT INTO content_slots (subject) VALUES ($1) RETURNING id, subject",
    [subject]
  );

  return created.rows[0];
};

const getNextRotationOrder = async (client, slotId) => {
  const result = await client.query(
    "SELECT COALESCE(MAX(rotation_order), 0) + 1 AS next_order FROM content_schedule WHERE slot_id = $1",
    [slotId]
  );

  return Number(result.rows[0].next_order);
};

const mapContentRow = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  subject: row.subject,
  file_url: row.file_url,
  file_path: row.file_path,
  file_type: row.file_type,
  file_size: Number(row.file_size),
  uploaded_by: row.uploaded_by,
  status: row.status,
  rejection_reason: row.rejection_reason,
  approved_by: row.approved_by,
  approved_at: row.approved_at,
  start_time: row.start_time,
  end_time: row.end_time,
  created_at: row.created_at,
  updated_at: row.updated_at,
  rotation_order: row.rotation_order ? Number(row.rotation_order) : null,
  duration_minutes: row.duration_minutes ? Number(row.duration_minutes) : null,
});

const createContent = async ({
  title,
  description,
  subject,
  startTime,
  endTime,
  rotationDurationMinutes,
  rotationOrder,
  file,
  uploadedBy,
}) =>
  withTransaction(async (client) => {
    const normalizedSubject = subject.trim().toLowerCase();
    const fileUrl = buildPublicFileUrl(file.filename);
    const requestedStartTime = parseOptionalDate(startTime, "start_time");
    const requestedEndTime = parseOptionalDate(endTime, "end_time");

    if ((requestedStartTime && !requestedEndTime) || (!requestedStartTime && requestedEndTime)) {
      throw new ApiError(400, "Both start_time and end_time must be provided together");
    }

    if (
      requestedStartTime &&
      requestedEndTime &&
      requestedEndTime <= requestedStartTime
    ) {
      throw new ApiError(400, "end_time must be later than start_time");
    }

    const insertResult = await client.query(
      `INSERT INTO content (
        title,
        description,
        subject,
        file_path,
        file_url,
        file_type,
        file_size,
        uploaded_by,
        status,
        start_time,
        end_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        normalizedSubject,
        file.path,
        fileUrl,
        file.mimetype,
        file.size,
        uploadedBy,
        CONTENT_STATUS.PENDING,
        requestedStartTime,
        requestedEndTime,
      ]
    );

    const content = insertResult.rows[0];
    let schedule = null;

    if (requestedStartTime && requestedEndTime) {
      const slot = await getOrCreateSlot(client, normalizedSubject);
      const durationMinutes = parsePositiveInteger(
        rotationDurationMinutes,
        "rotation_duration_minutes",
        env.defaultRotationDurationMinutes
      );
      const safeRotationOrder =
        parsePositiveInteger(rotationOrder, "rotation_order") ||
        (await getNextRotationOrder(client, slot.id));

      const scheduleResult = await client.query(
        `INSERT INTO content_schedule (
          content_id,
          slot_id,
          rotation_order,
          duration_minutes
        ) VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [content.id, slot.id, safeRotationOrder, durationMinutes]
      );

      schedule = scheduleResult.rows[0];
    }

    return mapContentRow({
      ...content,
      rotation_order: schedule?.rotation_order,
      duration_minutes: schedule?.duration_minutes,
    });
  });

const listContent = async ({
  requesterRole,
  requesterId,
  page,
  limit,
  subject,
  status,
  teacherId,
}) => {
  const { offset, limit: safeLimit, page: safePage } = getPagination({ page, limit });
  const conditions = [];
  const params = [];

  if (requesterRole === ROLES.TEACHER) {
    params.push(requesterId);
    conditions.push(`c.uploaded_by = $${params.length}`);
  }

  if (subject) {
    params.push(subject.trim().toLowerCase());
    conditions.push(`c.subject = $${params.length}`);
  }

  if (status) {
    params.push(status.trim().toLowerCase());
    conditions.push(`c.status = $${params.length}`);
  }

  if (teacherId) {
    params.push(Number(teacherId));
    conditions.push(`c.uploaded_by = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countParams = [...params];
  params.push(safeLimit, offset);

  const rowsPromise = query(
    `SELECT
      c.*,
      cs.rotation_order,
      cs.duration_minutes
     FROM content c
     LEFT JOIN content_schedule cs ON cs.content_id = c.id
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countPromise = query(
    `SELECT COUNT(*) AS total
     FROM content c
     ${whereClause}`,
    countParams
  );

  const [rowsResult, countResult] = await Promise.all([rowsPromise, countPromise]);
  const total = Number(countResult.rows[0].total);

  return {
    data: rowsResult.rows.map(mapContentRow),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      total_pages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

const getPendingContent = async ({ page, limit }) =>
  listContent({
    requesterRole: ROLES.PRINCIPAL,
    page,
    limit,
    status: CONTENT_STATUS.PENDING,
  });

const getContentById = async (id) => {
  const result = await query(
    `SELECT
      c.*,
      cs.rotation_order,
      cs.duration_minutes,
      cs.slot_id
     FROM content c
     LEFT JOIN content_schedule cs ON cs.content_id = c.id
     WHERE c.id = $1`,
    [id]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Content not found");
  }

  return mapContentRow(result.rows[0]);
};

const ensureTeacherOwnsContent = async (contentId, teacherId) => {
  const content = await getContentById(contentId);
  if (content.uploaded_by !== teacherId) {
    throw new ApiError(403, "You can only manage your own content");
  }

  return content;
};

const approveContent = async ({ contentId, principalId }) => {
  const content = await getContentById(contentId);

  if (content.status === CONTENT_STATUS.REJECTED) {
    throw new ApiError(409, "Rejected content cannot be approved directly");
  }

  if (content.status === CONTENT_STATUS.APPROVED) {
    return content;
  }

  const result = await query(
    `UPDATE content
     SET status = $1,
         approved_by = $2,
         approved_at = NOW(),
         rejection_reason = NULL,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [CONTENT_STATUS.APPROVED, principalId, contentId]
  );

  return mapContentRow(result.rows[0]);
};

const rejectContent = async ({ contentId, principalId, rejectionReason }) => {
  const content = await getContentById(contentId);

  if (content.status === CONTENT_STATUS.APPROVED) {
    throw new ApiError(
      409,
      "Approved content cannot be rejected directly. Update the schedule or create a new revision instead."
    );
  }

  const result = await query(
    `UPDATE content
     SET status = $1,
         approved_by = NULL,
         approved_at = NULL,
         rejection_reason = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [CONTENT_STATUS.REJECTED, rejectionReason.trim(), contentId]
  );

  return mapContentRow(result.rows[0]);
};

const upsertSchedule = async ({
  contentId,
  teacherId,
  startTime,
  endTime,
  rotationDurationMinutes,
  rotationOrder,
}) =>
  withTransaction(async (client) => {
    const contentResult = await client.query("SELECT * FROM content WHERE id = $1", [
      contentId,
    ]);

    if (contentResult.rowCount === 0) {
      throw new ApiError(404, "Content not found");
    }

    const content = contentResult.rows[0];

    if (content.uploaded_by !== teacherId) {
      throw new ApiError(403, "You can only schedule your own content");
    }

    const requestedStartTime = parseOptionalDate(startTime, "start_time");
    const requestedEndTime = parseOptionalDate(endTime, "end_time");

    if (!requestedStartTime || !requestedEndTime) {
      throw new ApiError(400, "Both start_time and end_time are required for scheduling");
    }

    if (requestedEndTime <= requestedStartTime) {
      throw new ApiError(400, "end_time must be later than start_time");
    }

    const slot = await getOrCreateSlot(client, content.subject);
    const durationMinutes = parsePositiveInteger(
      rotationDurationMinutes,
      "rotation_duration_minutes",
      env.defaultRotationDurationMinutes
    );
    let safeRotationOrder = parsePositiveInteger(rotationOrder, "rotation_order");

    if (!safeRotationOrder) {
      const currentSchedule = await client.query(
        "SELECT rotation_order FROM content_schedule WHERE content_id = $1",
        [contentId]
      );

      safeRotationOrder =
        currentSchedule.rowCount > 0
          ? Number(currentSchedule.rows[0].rotation_order)
          : await getNextRotationOrder(client, slot.id);
    }

    await client.query(
      `UPDATE content
       SET start_time = $1,
           end_time = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [requestedStartTime, requestedEndTime, contentId]
    );

    await client.query(
      `INSERT INTO content_schedule (content_id, slot_id, rotation_order, duration_minutes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (content_id)
       DO UPDATE SET
         slot_id = EXCLUDED.slot_id,
         rotation_order = EXCLUDED.rotation_order,
         duration_minutes = EXCLUDED.duration_minutes`,
      [contentId, slot.id, safeRotationOrder, durationMinutes]
    );

    const updated = await client.query(
      `SELECT
        c.*,
        cs.rotation_order,
        cs.duration_minutes
       FROM content c
       LEFT JOIN content_schedule cs ON cs.content_id = c.id
       WHERE c.id = $1`,
      [contentId]
    );

    return mapContentRow(updated.rows[0]);
  });

const getLiveContentByTeacher = async ({ teacherId, subject, now = new Date() }) => {
  const params = [teacherId];
  let subjectClause = "";

  if (subject) {
    params.push(subject.trim().toLowerCase());
    subjectClause = `AND c.subject = $${params.length}`;
  }

  const result = await query(
    `SELECT
      c.*,
      cs.rotation_order,
      cs.duration_minutes
     FROM content c
     LEFT JOIN content_schedule cs ON cs.content_id = c.id
     WHERE c.uploaded_by = $1
       AND c.status = '${CONTENT_STATUS.APPROVED}'
       ${subjectClause}
     ORDER BY c.subject ASC, cs.rotation_order ASC, c.id ASC`,
    params
  );

  if (result.rowCount === 0) {
    return [];
  }

  const livePayload = getActiveContentPayload(
    result.rows.map((row) => ({
      ...mapContentRow(row),
      duration_minutes: Number(row.duration_minutes),
      rotation_order: Number(row.rotation_order),
    })),
    now
  );

  return subject ? livePayload.slice(0, 1) : livePayload;
};

module.exports = {
  createContent,
  listContent,
  getPendingContent,
  approveContent,
  rejectContent,
  upsertSchedule,
  getLiveContentByTeacher,
  ensureTeacherOwnsContent,
};
