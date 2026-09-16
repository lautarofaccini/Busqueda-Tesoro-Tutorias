/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Worker environment bindings.
 * Phase 1: D1 database binding enabled for local development.
 */
export interface Env {
  DB: D1Database
  ORGANIZER_SECRET: string
  ENVIRONMENT?: string
}
