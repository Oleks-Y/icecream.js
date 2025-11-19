export interface CallerPos {
  file?: string;
  line?: number;
  col?: number;
  fn?: string;
}

export interface OriginalPos extends CallerPos {}

export type PrefixFunction = () => string;
export type OutputFunction = (output: string) => void;
export type ArgToStringFunction = (value: unknown) => string;

export interface IcConfiguration {
  prefix: string | PrefixFunction;
  outputFunction: OutputFunction;
  argToStringFunction: ArgToStringFunction;
  includeContext: boolean;
  contextAbsPath: boolean;
}
