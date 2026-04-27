const fs = require("fs/promises");

const safeUnlink = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (_error) {
    // Ignore cleanup failures so the original error can surface.
  }
};

module.exports = {
  safeUnlink,
};

