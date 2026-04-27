const path = require("path");
const { env } = require("../config/env");

const buildPublicFileUrl = (filename) =>
  `${env.publicBaseUrl.replace(/\/$/, "")}/uploads/${filename}`;

const getFileTypeFromMimetype = (mimetype) => {
  const extension = path.extname(mimetype || "").replace(".", "").toLowerCase();
  return extension || "unknown";
};

module.exports = {
  buildPublicFileUrl,
  getFileTypeFromMimetype,
};

