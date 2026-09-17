/** Nest-free stand-ins used by the vendored KnowEmp adapter. */

export class Logger {
  context: string
  constructor(context = 'knowemp') {
    this.context = context
  }
  log(message: string): void { console.log(`[${this.context}] ${message}`) }
  warn(message: string): void { console.warn(`[${this.context}] ${message}`) }
  debug(message: string): void { console.debug(`[${this.context}] ${message}`) }
  error(message: string): void { console.error(`[${this.context}] ${message}`) }
}

export class ConfigService {
  get<T = string>(key: string): T | undefined {
    const value = process.env[key]
    return (value === undefined || value === '' ? undefined : value) as T | undefined
  }
}

export class NotFoundException extends Error {
  constructor(message = 'Not Found') {
    super(message)
    this.name = 'NotFoundException'
  }
}
