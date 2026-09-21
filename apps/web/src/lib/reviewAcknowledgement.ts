const STORAGE_KEY = 'tutorias:acknowledged-answer-reviews:v1'

function readAcknowledged(): number[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : []
  } catch {
    return []
  }
}

export function isReviewAcknowledged(reviewId: number): boolean {
  return readAcknowledged().includes(reviewId)
}

export function acknowledgeReview(reviewId: number): void {
  const acknowledged = [reviewId, ...readAcknowledged().filter(id => id !== reviewId)].slice(0, 50)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(acknowledged))
  } catch {
    // The notification can still be dismissed for this render if storage is unavailable.
  }
}
