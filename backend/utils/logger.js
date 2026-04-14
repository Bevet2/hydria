const levels = {
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
  debug: "DEBUG"
};

function formatLine(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaText = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${levels[level]}] ${message}${metaText}`;
}

function write(level, message, meta) {
  const line = formatLine(level, message, meta);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(message, meta) {
    write("info", message, meta);
  },
  warn(message, meta) {
    write("warn", message, meta);
  },
  error(message, meta) {
    write("error", message, meta);
  },
  debug(message, meta) {
    if (process.env.NODE_ENV !== "production") {
      write("debug", message, meta);
    }
  }
};

export default logger;

