/** Common contract for token estimators (brief §5.3). */
export interface TokenEstimate {
  count: number;
  /** Human-readable method label shown beside every result. */
  method: string;
  /** True unless the count is exact for the user's model. */
  approximate: boolean;
}

export interface TokenizerAdapter {
  id: string;
  name: string;
  approximate: boolean;
  estimate(text: string): Promise<TokenEstimate>;
}
