export function publicApiConfigurationError(scope: string | undefined, value: string | undefined): string | null;
export function publicShowcaseBuildMetadata(scope: string | undefined, apiBase: string | undefined): { format: number; scope: 'public-showcase'; apiBase: string } | null;
export function publicShowcaseRuntimeError(scope: string | undefined, metadata: unknown, runtimeApiBase?: string): string | null;
export function catalogUpstreamConfigurationError(value: string | undefined): string | null;
export function readPublicShowcaseBuildMetadata(cwd: string, distDirectory: string): unknown;
