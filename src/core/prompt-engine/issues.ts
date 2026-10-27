export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
  | 'undeclared-placeholder'
  | 'invalid-placeholder'
  | 'unused-variable'
  | 'missing-required-value'
  | 'invalid-value'
  | 'empty-required-section';

export interface Issue {
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  sectionId?: string;
  variable?: string;
}

export const hasErrors = (issues: readonly Issue[]) => issues.some((i) => i.severity === 'error');
