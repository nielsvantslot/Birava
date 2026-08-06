/** Raw payload posted by components/client-error-reporter.tsx / public/sw.js. */
export class ReportClientErrorDTO {
  declare source: string;
  declare message: string;
  declare stack: string | null;
  declare pageUrl: string | null;
  declare userAgent: string | null;
  /** Anything beyond the common fields above — shape varies by source. */
  declare context: Record<string, unknown> | null;
}
