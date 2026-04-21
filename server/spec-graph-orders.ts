/**
 * Task #563 — On-demand BFS helpers over the scaffold invocation graph.
 *
 * Replaces the previous baked-in `executionOrder: string[]` field in
 * `SpecScaffoldMeta`. Callers compute order on demand from the
 * scaffold's `entryWorkflow` + per-workflow `invokes` edges.
 *
 *   - `getCallerFirstOrder(meta)`: BFS from entry, callers BEFORE callees.
 *     Used by wrappers (Main.xaml/Process.xaml) that must invoke the entry
 *     workflow first and then its descendants.
 *
 *   - `getCalleeFirstOrder(meta)`: reverse-topological order — leaves first,
 *     then their callers, ending at the entry workflow. Used by the detail
 *     loop so that callee contracts are emitted before their callers.
 *
 * Both helpers are tolerant of cycles and unreachable workflows: any
 * workflow not visited from `entryWorkflow` is appended at the end in
 * declaration order (the spec-graph validator is responsible for failing
 * the run on cycles/orphans separately).
 */

import type { SpecScaffoldMeta } from "./types/uipath-package";

function buildAdjacency(meta: SpecScaffoldMeta): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const c of meta.workflowContracts) {
    adj.set(c.name, (c.invokes || []).map(i => i.target));
  }
  return adj;
}

export function getCallerFirstOrder(meta: SpecScaffoldMeta): string[] {
  const adj = buildAdjacency(meta);
  const order: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [];
  if (meta.entryWorkflow && adj.has(meta.entryWorkflow)) {
    queue.push(meta.entryWorkflow);
    visited.add(meta.entryWorkflow);
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const next of adj.get(cur) || []) {
      if (!visited.has(next) && adj.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  for (const c of meta.workflowContracts) {
    if (!visited.has(c.name)) order.push(c.name);
  }
  return order;
}

export function getCalleeFirstOrder(meta: SpecScaffoldMeta): string[] {
  const adj = buildAdjacency(meta);
  const visited = new Set<string>();
  const order: string[] = [];
  const onStack = new Set<string>();
  function dfs(node: string): void {
    if (visited.has(node) || onStack.has(node)) return;
    onStack.add(node);
    for (const next of adj.get(node) || []) {
      if (adj.has(next)) dfs(next);
    }
    onStack.delete(node);
    if (!visited.has(node)) {
      visited.add(node);
      order.push(node);
    }
  }
  if (meta.entryWorkflow && adj.has(meta.entryWorkflow)) {
    dfs(meta.entryWorkflow);
  }
  for (const c of meta.workflowContracts) {
    if (!visited.has(c.name)) {
      dfs(c.name);
      if (!visited.has(c.name)) {
        visited.add(c.name);
        order.push(c.name);
      }
    }
  }
  return order;
}
