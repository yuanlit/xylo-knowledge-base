export interface OrderedListEnterEdit {
  content: string;
  cursor: number;
}

export interface OrderedListDeletionEdit {
  content: string;
  cursor: number;
}

const ORDERED_LIST_PATTERN = /^([ \t]*)(\d+)([.)])([ \t]+)(.*)$/;

interface LineBounds {
  start: number;
  end: number;
  eolEnd: number;
  eol: string;
}

interface Fence {
  marker: "`" | "~";
  length: number;
}

function getLineBounds(content: string, position: number): LineBounds {
  const safePosition = Math.max(0, Math.min(position, content.length));
  const previousLf = content.lastIndexOf("\n", safePosition - 1);
  const previousCr = content.lastIndexOf("\r", safePosition - 1);
  const start = Math.max(previousLf, previousCr) + 1;
  const nextLf = content.indexOf("\n", safePosition);
  const nextCr = content.indexOf("\r", safePosition);
  const candidates = [nextLf, nextCr].filter((index) => index !== -1);
  const end = candidates.length > 0 ? Math.min(...candidates) : content.length;

  if (end === content.length) {
    return { start, end, eolEnd: end, eol: "" };
  }

  const eol = content.startsWith("\r\n", end) ? "\r\n" : content[end];
  return { start, end, eolEnd: end + eol.length, eol };
}

function getPreferredEol(content: string, bounds: LineBounds): string {
  if (bounds.eol) return bounds.eol;
  return content.match(/\r\n|\r|\n/)?.[0] || "\n";
}

function getIndentWidth(indent: string): number {
  let width = 0;
  for (const character of indent) {
    width += character === "\t" ? 4 - (width % 4) : 1;
  }
  return width;
}

function getFenceMarker(line: string): Fence | null {
  const match = line.match(/^[ \t]*(`{3,}|~{3,})/);
  if (!match) return null;
  return {
    marker: match[1][0] as Fence["marker"],
    length: match[1].length,
  };
}

function isFenceClosingLine(line: string, fence: Fence): boolean {
  const match = line.match(/^[ \t]*(`{3,}|~{3,})[ \t]*$/);
  return Boolean(
    match &&
      match[1][0] === fence.marker &&
      match[1].length >= fence.length,
  );
}

function isInsideFence(content: string, lineStart: number): boolean {
  let position = 0;
  let fence: Fence | null = null;

  while (position < lineStart) {
    const bounds = getLineBounds(content, position);
    const line = content.slice(bounds.start, bounds.end);

    if (fence) {
      if (isFenceClosingLine(line, fence)) fence = null;
    } else {
      fence = getFenceMarker(line);
    }

    if (bounds.eolEnd <= position) break;
    position = bounds.eolEnd;
  }

  return fence !== null;
}

function renumberFollowingItems(
  content: string,
  start: number,
  indentWidth: number,
  delimiter: string,
  firstNumber: number,
): string {
  const replacements: Array<{ start: number; end: number; value: string }> = [];
  let position = start;
  let nextNumber = firstNumber;
  let fence: Fence | null = null;

  while (position < content.length) {
    const bounds = getLineBounds(content, position);
    const line = content.slice(bounds.start, bounds.end);

    if (fence) {
      if (isFenceClosingLine(line, fence)) fence = null;
    } else {
      if (/^[ \t]*$/.test(line)) break;

      const lineIndent = line.match(/^[ \t]*/)?.[0] || "";
      const lineIndentWidth = getIndentWidth(lineIndent);
      if (lineIndentWidth < indentWidth) break;

      const fenceMarker = getFenceMarker(line);
      if (fenceMarker) {
        if (lineIndentWidth === indentWidth) break;
        fence = fenceMarker;
      } else if (lineIndentWidth === indentWidth) {
        const item = line.match(ORDERED_LIST_PATTERN);
        if (!item || item[3] !== delimiter) break;

        const numberStart = bounds.start + item[1].length;
        replacements.push({
          start: numberStart,
          end: numberStart + item[2].length,
          value: String(nextNumber),
        });
        nextNumber += 1;
      }
    }

    if (bounds.eolEnd <= position) break;
    position = bounds.eolEnd;
  }

  return replacements.reduceRight(
    (result, replacement) =>
      result.slice(0, replacement.start) +
      replacement.value +
      result.slice(replacement.end),
    content,
  );
}

function getDeletedListItem(previousContent: string, content: string) {
  const deletedLength = previousContent.length - content.length;
  let position = 0;

  while (position < previousContent.length) {
    const bounds = getLineBounds(previousContent, position);
    const line = previousContent.slice(bounds.start, bounds.end);
    const item = line.match(ORDERED_LIST_PATTERN);

    if (item) {
      const deletionRanges = [
        { start: bounds.start, end: bounds.eolEnd },
        { start: bounds.start, end: bounds.end },
      ];

      if (bounds.start > 0 && bounds.eolEnd === previousContent.length) {
        const previousBounds = getLineBounds(previousContent, bounds.start - 1);
        deletionRanges.push({ start: previousBounds.end, end: bounds.end });
      }

      const deletionRange = deletionRanges.find(
        (range) =>
          range.end - range.start === deletedLength &&
          previousContent.slice(0, range.start) ===
            content.slice(0, range.start) &&
          previousContent.slice(range.end) === content.slice(range.start),
      );

      if (deletionRange && !isInsideFence(previousContent, bounds.start)) {
        return {
          changeStart: deletionRange.start,
          skipEmptyLine: deletionRange.end === bounds.end,
          indentWidth: getIndentWidth(item[1]),
          delimiter: item[3],
          number: Number(item[2]),
        };
      }
    }

    if (bounds.eolEnd <= position) break;
    position = bounds.eolEnd;
  }

  return null;
}

function normalizeOrderedListAtPosition(
  content: string,
  position: number,
): string | null {
  const lines: LineBounds[] = [];
  let linePosition = 0;

  while (linePosition <= content.length) {
    const bounds = getLineBounds(content, linePosition);
    lines.push(bounds);
    if (bounds.eolEnd <= linePosition || bounds.eolEnd >= content.length) break;
    linePosition = bounds.eolEnd;
  }

  const safePosition = Math.max(0, Math.min(position, content.length));
  const currentLineIndex = lines.findIndex(
    (bounds) => safePosition >= bounds.start && safePosition <= bounds.end,
  );
  const candidateIndices = [
    currentLineIndex,
    currentLineIndex + 1,
    currentLineIndex - 1,
  ];
  const candidateIndex = candidateIndices.find((index) => {
    if (index < 0 || index >= lines.length) return false;
    const bounds = lines[index];
    return Boolean(
      content.slice(bounds.start, bounds.end).match(ORDERED_LIST_PATTERN) &&
        !isInsideFence(content, bounds.start),
    );
  });

  if (candidateIndex === undefined) return null;

  const candidateBounds = lines[candidateIndex];
  const candidate = content
    .slice(candidateBounds.start, candidateBounds.end)
    .match(ORDERED_LIST_PATTERN);
  if (!candidate) return null;

  const indentWidth = getIndentWidth(candidate[1]);
  const delimiter = candidate[3];
  let firstItemIndex = candidateIndex;

  for (let index = candidateIndex - 1; index >= 0; index -= 1) {
    const bounds = lines[index];
    const line = content.slice(bounds.start, bounds.end);
    if (/^[ \t]*$/.test(line)) break;

    const lineIndent = line.match(/^[ \t]*/)?.[0] || "";
    const lineIndentWidth = getIndentWidth(lineIndent);
    if (lineIndentWidth < indentWidth) break;
    if (lineIndentWidth > indentWidth) continue;

    const item = line.match(ORDERED_LIST_PATTERN);
    if (!item || item[3] !== delimiter) break;
    firstItemIndex = index;
  }

  const firstBounds = lines[firstItemIndex];
  const firstItem = content
    .slice(firstBounds.start, firstBounds.end)
    .match(ORDERED_LIST_PATTERN);
  if (!firstItem) return null;

  const normalizedContent = renumberFollowingItems(
    content,
    firstBounds.start,
    indentWidth,
    delimiter,
    Number(firstItem[2]),
  );

  return normalizedContent === content ? null : normalizedContent;
}

export function handleOrderedListDeletion(
  previousContent: string,
  content: string,
  cursor: number,
): OrderedListDeletionEdit | null {
  if (content.length >= previousContent.length) return null;

  const deletedItem = getDeletedListItem(previousContent, content);
  if (!deletedItem) {
    const normalizedContent = normalizeOrderedListAtPosition(content, cursor);
    if (!normalizedContent) return null;
    return {
      content: normalizedContent,
      cursor: Math.max(0, Math.min(cursor, normalizedContent.length)),
    };
  }

  const changedLine = getLineBounds(content, deletedItem.changeStart);
  const renumberStart = deletedItem.changeStart >= content.length
    ? content.length
    : deletedItem.skipEmptyLine &&
        /^[ \t]*$/.test(content.slice(changedLine.start, changedLine.end))
      ? changedLine.eolEnd
      : changedLine.start;

  const renumberedContent = renumberFollowingItems(
    content,
    renumberStart,
    deletedItem.indentWidth,
    deletedItem.delimiter,
    deletedItem.number,
  );

  if (renumberedContent === content) {
    return {
      content,
      cursor: Math.max(0, Math.min(cursor, content.length)),
    };
  }

  return {
    content: renumberedContent,
    cursor: Math.max(0, Math.min(cursor, renumberedContent.length)),
  };
}

export function handleOrderedListEnter(
  content: string,
  selectionStart: number,
  selectionEnd: number,
): OrderedListEnterEdit | null {
  const start = Math.max(0, Math.min(selectionStart, content.length));
  const end = Math.max(start, Math.min(selectionEnd, content.length));
  const contentWithoutSelection = content.slice(0, start) + content.slice(end);
  const bounds = getLineBounds(contentWithoutSelection, start);
  const line = contentWithoutSelection.slice(bounds.start, bounds.end);
  const item = line.match(ORDERED_LIST_PATTERN);

  if (!item) return null;

  const markerLength = item[1].length + item[2].length + item[3].length + item[4].length;
  const cursorInLine = start - bounds.start;
  if (cursorInLine < markerLength) return null;

  const eol = getPreferredEol(contentWithoutSelection, bounds);
  const beforeCursor = contentWithoutSelection.slice(bounds.start, start);
  const afterCursor = contentWithoutSelection.slice(start, bounds.end);

  if (isInsideFence(contentWithoutSelection, bounds.start)) {
    const replacement = beforeCursor + eol + afterCursor;
    return {
      content:
        contentWithoutSelection.slice(0, bounds.start) +
        replacement +
        contentWithoutSelection.slice(bounds.end),
      cursor: bounds.start + beforeCursor.length + eol.length,
    };
  }

  const currentNumber = Number(item[2]);
  const indentWidth = getIndentWidth(item[1]);

  if (start === end && item[5].trim() === "") {
    const nextContent =
      contentWithoutSelection.slice(0, bounds.start) +
      contentWithoutSelection.slice(bounds.end);
    const emptyLineBounds = getLineBounds(nextContent, bounds.start);
    return {
      content: renumberFollowingItems(
        nextContent,
        emptyLineBounds.eolEnd,
        indentWidth,
        item[3],
        currentNumber,
      ),
      cursor: bounds.start,
    };
  }

  const nextMarker = `${item[1]}${currentNumber + 1}${item[3]}${item[4]}`;
  const replacement = beforeCursor + eol + nextMarker + afterCursor;
  const nextContent =
    contentWithoutSelection.slice(0, bounds.start) +
    replacement +
    contentWithoutSelection.slice(bounds.end);
  const cursor = bounds.start + beforeCursor.length + eol.length + nextMarker.length;
  const insertedLineBounds = getLineBounds(nextContent, cursor);

  return {
    content: renumberFollowingItems(
      nextContent,
      insertedLineBounds.eolEnd,
      indentWidth,
      item[3],
      currentNumber + 2,
    ),
    cursor,
  };
}
