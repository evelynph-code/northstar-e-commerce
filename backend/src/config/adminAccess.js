export const adminEmail = 'phammaikha7@gmail.com'

export function isAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === adminEmail
}
