const encoder = new TextEncoder()

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index++) difference |= left[index]! ^ right[index]!
  return difference === 0
}

/** Timing-safe comparison for SHA-256-derived credential digests. */
export async function timingSafeSecretEqual(expected: string | undefined, supplied: string): Promise<boolean> {
  if (!expected) return false
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
  ])
  return timingSafeEqual(new Uint8Array(expectedHash), new Uint8Array(suppliedHash))
}
