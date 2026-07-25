// Random credentials for signature-only writer profiles (nobody logs into them)
export const randomToken = (len: number) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => chars[n % chars.length]).join('')
}

// Throwaway login for a writer profile: ascii-safe email + strong password
export const generateWriterCredentials = (name: string) => {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const ascii = slug && /^[a-z0-9-]+$/.test(slug) ? slug : 'writer'
  return {
    email: `${ascii}-${randomToken(6).toLowerCase()}@profiles.al-telegraph.com`,
    password: randomToken(20),
  }
}
