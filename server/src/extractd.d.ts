declare module 'extractd' {
  interface GenerateOptions {
    destination?: string;
    stream?: boolean;
    base64?: boolean;
    datauri?: boolean;
    persist?: boolean;
    compact?: boolean;
  }
  interface GenerateResult {
    preview: string;
    source: string;
  }
  interface GenerateError {
    error: string;
    source: string;
  }
  function generate(
    path: string | string[],
    options?: GenerateOptions
  ): Promise<GenerateResult | GenerateError | string[]>;
}
