export const logger = {
  info(message: string, ...meta: any[]) {
    console.info(`[INFO] ${message}`, ...meta)
  },
  error(message: string, ...meta: any[]) {
    console.error(`[ERROR] ${message}`, ...meta)
  },
  warn(message: string, ...meta: any[]) {
    console.warn(`[WARN] ${message}`, ...meta)
  },
  debug(message: string, ...meta: any[]) {
    console.debug(`[DEBUG] ${message}`, ...meta)
  }
}
