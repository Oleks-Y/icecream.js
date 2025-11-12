export interface CallerPos {
  file?: string;
  line?: number;
  col?: number;
  fn?: string;
}

export interface OriginalPos extends CallerPos {}
