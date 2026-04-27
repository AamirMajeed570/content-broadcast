const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { env } = require("../config/env");
const { ApiError } = require("../utils/api-error");

fs.mkdirSync(env.uploadDir, { recursive: true });

const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
];

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, env.uploadDir),
  filename: (_req, file, callback) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/\s+/g, "-").toLowerCase();
    callback(null, `${timestamp}-${cleanName}`);
  },
});

const fileFilter = (_req, file, callback) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(new ApiError(400, "Only JPG, PNG, and GIF files are allowed"));
  }

  return callback(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxFileSizeBytes,
  },
  fileFilter,
});

const getStoredFilename = (filePath) => path.basename(filePath);

module.exports = {
  upload,
  getStoredFilename,
};

