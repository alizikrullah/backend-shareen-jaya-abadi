// Error dengan status HTTP — dilempar dari service, ditangkap errorHandler
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
