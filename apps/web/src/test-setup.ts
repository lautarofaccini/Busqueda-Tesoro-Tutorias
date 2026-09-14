import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Automatically unmount and clean up DOM after every test.
// Required because vitest doesn't call global afterEach without globals:true,
// so @testing-library/react's auto-cleanup doesn't fire otherwise.
afterEach(() => {
  cleanup()
})
