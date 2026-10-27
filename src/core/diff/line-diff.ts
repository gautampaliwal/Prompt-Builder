export type DiffOp = { type: 'same' | 'add' | 'del'; text: string };
export type DiffRow = DiffOp | { type: 'skip'; count: number };

/** Above this many LCS cells, the changed middle is shown as remove-all/add-all. */
export const DIFF_MAX_CELLS = 4_000_000;

const lines = (s: string) => (s === '' ? [] : s.split('\n'));

/**
 * Line diff from `a` to `b`. Common leading and trailing lines are matched
 * first, then the changed middle is aligned by longest common subsequence.
 * Very large middles fall back to "all removed, all added", which is still
 * correct, just less granular.
 */
export function diffLines(a: string, b: string, maxCells = DIFF_MAX_CELLS): DiffOp[] {
  const A = lines(a);
  const B = lines(b);
  let start = 0;
  while (start < A.length && start < B.length && A[start] === B[start]) start += 1;
  let endA = A.length;
  let endB = B.length;
  while (endA > start && endB > start && A[endA - 1] === B[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const same = (t: string): DiffOp => ({ type: 'same', text: t });
  return [
    ...A.slice(0, start).map(same),
    ...diffMiddle(A.slice(start, endA), B.slice(start, endB), maxCells),
    ...A.slice(endA).map(same),
  ];
}

function diffMiddle(A: string[], B: string[], maxCells: number): DiffOp[] {
  const del = (t: string): DiffOp => ({ type: 'del', text: t });
  const add = (t: string): DiffOp => ({ type: 'add', text: t });
  const n = A.length;
  const m = B.length;
  if (n === 0 || m === 0 || (n + 1) * (m + 1) > maxCells) return [...A.map(del), ...B.map(add)];

  // L[i][j] = LCS length of A[i..] and B[j..], stored row-major.
  const w = m + 1;
  const L = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      L[i * w + j] =
        A[i] === B[j]
          ? (L[(i + 1) * w + j + 1] ?? 0) + 1
          : Math.max(L[(i + 1) * w + j] ?? 0, L[i * w + j + 1] ?? 0);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const ai = A[i] ?? '';
    const bj = B[j] ?? '';
    if (ai === bj) {
      ops.push({ type: 'same', text: ai });
      i += 1;
      j += 1;
    } else if ((L[(i + 1) * w + j] ?? 0) >= (L[i * w + j + 1] ?? 0)) {
      ops.push(del(ai));
      i += 1;
    } else {
      ops.push(add(bj));
      j += 1;
    }
  }
  while (i < n) ops.push(del(A[i++] ?? ''));
  while (j < m) ops.push(add(B[j++] ?? ''));
  return ops;
}

/** Collapses long runs of unchanged lines, keeping `context` lines next to each change. */
export function withContext(ops: readonly DiffOp[], context = 3): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op === undefined) break;
    if (op.type !== 'same') {
      rows.push(op);
      i += 1;
      continue;
    }
    let j = i;
    while (j < ops.length && ops[j]?.type === 'same') j += 1;
    const run = ops.slice(i, j);
    const head = i === 0 ? 0 : context;
    const tail = j === ops.length ? 0 : context;
    if (run.length > head + tail + 1) {
      rows.push(...run.slice(0, head), { type: 'skip', count: run.length - head - tail });
      rows.push(...run.slice(run.length - tail));
    } else {
      rows.push(...run);
    }
    i = j;
  }
  return rows;
}

export function diffCounts(ops: readonly DiffOp[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === 'add') added += 1;
    else if (op.type === 'del') removed += 1;
  }
  return { added, removed };
}
