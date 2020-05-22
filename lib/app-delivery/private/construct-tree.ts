import { App } from "@aws-cdk/core";

/**
 * Get the outDir of an App
 *
 * Uses nasty tricks to read the private member, there is no public API for this
 * but we need it for validation.
 */
export function appOutDir(app: App): string {
  return (app as any).outdir ?? 'cdk.out';
}