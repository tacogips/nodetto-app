import { codeSnippetTextRuns } from "../code-snippet/text-runs.ts";
import { markdownSnippetTextRuns } from "../markdown-snippet/text-runs.ts";
import type { TextRunExtractor } from "./text-runs.ts";
export const PDF_TEXT_RUN_EXTRACTORS: Readonly<
  Record<string, TextRunExtractor>
> = {
  "text.code": codeSnippetTextRuns,
  "text.markdown": markdownSnippetTextRuns,
};
