export interface Io {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface GlobalArgs {
  readonly dbPath: string;
  readonly rest: readonly string[];
}

export interface ParsedArgs {
  readonly options: ReadonlyMap<string, string>;
  readonly positional: readonly string[];
}
