const {
  uploadContentSchema,
  updateScheduleSchema,
  decisionSchema,
} = require("../validators/content.validator");
const {
  createContent,
  listContent,
  getPendingContent,
  approveContent,
  rejectContent,
  upsertSchedule,
  getLiveContentByTeacher,
} = require("../services/content.service");
const { ApiError } = require("../utils/api-error");
const { safeUnlink } = require("../utils/fs");

const uploadContent = async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "File is required");
  }

  const parsed = uploadContentSchema.safeParse(req.body);
  console.log("Parsed content upload payload:", parsed);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid content upload payload", parsed.error.flatten());
  }

  let content;

  try {
    content = await createContent({
      title: parsed.data.title,
      description: parsed.data.description,
      subject: parsed.data.subject,
      startTime: parsed.data.start_time,
      endTime: parsed.data.end_time,
      rotationDurationMinutes: Number(parsed.data.rotation_duration_minutes),
      rotationOrder: parsed.data.rotation_order,
      file: req.file,
      uploadedBy: req.user.id,
    });
  } catch (error) {
    await safeUnlink(req.file.path);
    throw error;
  }

  res.status(201).json({
    success: true,
    message: "Content uploaded successfully and sent for approval",
    data: content,
  });
};

const getMyContent = async (req, res) => {
  const result = await listContent({
    requesterRole: req.user.role,
    requesterId: req.user.id,
    page: req.query.page,
    limit: req.query.limit,
    subject: req.query.subject,
    status: req.query.status,
    teacherId: req.query.teacher_id,
  });

  res.status(200).json({
    success: true,
    ...result,
  });
};

const getPending = async (req, res) => {
  const result = await getPendingContent({
    page: req.query.page,
    limit: req.query.limit,
  });

  res.status(200).json({
    success: true,
    ...result,
  });
};

const approve = async (req, res) => {
  const content = await approveContent({
    contentId: Number(req.params.id),
    principalId: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: "Content approved successfully",
    data: content,
  });
};

const reject = async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.rejection_reason) {
    throw new ApiError(400, "rejection_reason is required");
  }

  const content = await rejectContent({
    contentId: Number(req.params.id),
    principalId: req.user.id,
    rejectionReason: parsed.data.rejection_reason,
  });

  res.status(200).json({
    success: true,
    message: "Content rejected successfully",
    data: content,
  });
};

const updateSchedule = async (req, res) => {
  const parsed = updateScheduleSchema.safeParse(req.body);
  console.log("Parsed schedule update payload:", parsed);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid scheduling payload", parsed.error.flatten());
  }

  const content = await upsertSchedule({
    contentId: Number(req.params.id),
    teacherId: req.user.id,
    startTime: parsed.data.start_time,
    endTime: parsed.data.end_time,
    rotationDurationMinutes: parsed.data.rotation_duration_minutes,
    rotationOrder: parsed.data.rotation_order,
  });

  res.status(200).json({
    success: true,
    message: "Schedule updated successfully",
    data: content,
  });
};

const getLiveContent = async (req, res) => {
  const teacherId = Number(req.params.teacherId);
  console.log("Fetching live content for teacherId:", teacherId);
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    return res.status(200).json({
      success: true,
      data: [],
      message: "No content available",
    });
  }

  const data = await getLiveContentByTeacher({
    teacherId,
    subject: req.query.subject,
  });

  res.status(200).json({
    success: true,
    data,
    message: data.length === 0 ? "No content available" : undefined,
  });
};

module.exports = {
  uploadContent,
  getMyContent,
  getPending,
  approve,
  reject,
  updateSchedule,
  getLiveContent,
};
