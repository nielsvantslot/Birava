import type { ProcessingConfig } from "./ProcessingConfig";

export interface SharpImageProcessorConfig extends ProcessingConfig {
  readonly maxInputBytes: number;
}
