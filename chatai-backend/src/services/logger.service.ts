import { secretsSanitizerService } from './secrets-sanitizer.service'

function sanitizeArg(arg: any): any {
  if (typeof arg === 'string') {
    return secretsSanitizerService.sanitizeText(arg)
  }
  if (typeof arg === 'object' && arg !== null) {
    return secretsSanitizerService.sanitizeObject(arg)
  }
  return arg
}

export const logger = {
  info(message: string, ...meta: any[]) {
    const cleanMsg = secretsSanitizerService.sanitizeText(message)
    const cleanMeta = meta.map(sanitizeArg)
    console.info(`[INFO] ${cleanMsg}`, ...cleanMeta)
  },
  error(message: string, ...meta: any[]) {
    const cleanMsg = secretsSanitizerService.sanitizeText(message)
    const cleanMeta = meta.map(sanitizeArg)
    console.error(`[ERROR] ${cleanMsg}`, ...cleanMeta)
  },
  warn(message: string, ...meta: any[]) {
    const cleanMsg = secretsSanitizerService.sanitizeText(message)
    const cleanMeta = meta.map(sanitizeArg)
    console.warn(`[WARN] ${cleanMsg}`, ...cleanMeta)
  },
  debug(message: string, ...meta: any[]) {
    const cleanMsg = secretsSanitizerService.sanitizeText(message)
    const cleanMeta = meta.map(sanitizeArg)
    console.debug(`[DEBUG] ${cleanMsg}`, ...cleanMeta)
  }
}
