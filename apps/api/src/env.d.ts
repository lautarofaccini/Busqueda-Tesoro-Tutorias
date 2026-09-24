/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Worker environment bindings.
 * Phase 1: D1 database binding enabled for local development.
 */
export interface Env {
  DB: D1Database
  ORGANIZER_SECRET: string
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string
  PARTICIPANT_ID_SECRET: string
  ASSISTANCE_USERNAME: string
  ASSISTANCE_PASSWORD: string
  ADMIN_LOGIN_LIMITER?: RateLimit
  ENVIRONMENT?: string
}
