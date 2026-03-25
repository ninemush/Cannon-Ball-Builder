import { XMLParser, XMLBuilder } from "fast-xml-parser";

export type FxpNode = Record<string, any>;

const ATTR_PREFIX = "@_";

const parserOptions = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: ATTR_PREFIX,
  allowBooleanAttributes: true,
  processEntities: true,
  htmlEntities: true,
  trimValues: false,
  parseTagValue: false,
  commentPropName: "#comment",
};

const builderOptions = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: ATTR_PREFIX,
  format: true,
  indentBy: "  ",
  suppressEmptyNode: true,
  commentPropName: "#comment",
  processEntities: true,
};

export function parseXaml(xml: string): FxpNode[] {
  const parser = new XMLParser(parserOptions);
  return parser.parse(xml);
}

export function serializeXaml(tree: FxpNode[]): string {
  const builder = new XMLBuilder(builderOptions);
  let result = builder.build(tree);
  if (typeof result === "string") {
    result = result.replace(/^\s*\n/, "");
  }
  return result;
}

export function getTagName(node: FxpNode): string {
  for (const key of Object.keys(node)) {
    if (key !== ":@" && key !== "#text" && key !== "#comment") return key;
  }
  return "";
}

export function isElement(node: FxpNode): boolean {
  const tag = getTagName(node);
  return tag !== "" && !("#text" in node) && !("#comment" in node);
}

export function isTextNode(node: FxpNode): boolean {
  return "#text" in node;
}

export function getTextContent(node: FxpNode): string {
  const tag = getTagName(node);
  if (!tag) return "";
  const children = node[tag];
  if (!Array.isArray(children)) return "";
  for (const child of children) {
    if ("#text" in child) return String(child["#text"]);
  }
  return "";
}

export function setTextContent(node: FxpNode, text: string): void {
  const tag = getTagName(node);
  if (!tag) return;
  if (!Array.isArray(node[tag])) node[tag] = [];
  const children = node[tag] as FxpNode[];
  const textIdx = children.findIndex((c) => "#text" in c);
  if (textIdx >= 0) {
    children[textIdx]["#text"] = text;
  } else {
    children.push({ "#text": text });
  }
}

export function getChildren(node: FxpNode): FxpNode[] {
  const tag = getTagName(node);
  if (!tag) return [];
  return Array.isArray(node[tag]) ? node[tag] : [];
}

export function setChildren(node: FxpNode, children: FxpNode[]): void {
  const tag = getTagName(node);
  if (!tag) return;
  node[tag] = children;
}

export function getAttr(node: FxpNode, name: string): string | undefined {
  const attrs = node[":@"];
  if (!attrs) return undefined;
  const val = attrs[ATTR_PREFIX + name];
  return val !== undefined ? String(val) : undefined;
}

export function setAttr(node: FxpNode, name: string, value: string): void {
  if (!node[":@"]) node[":@"] = {};
  node[":@"][ATTR_PREFIX + name] = value;
}

export function removeAttr(node: FxpNode, name: string): void {
  if (node[":@"]) {
    delete node[":@"][ATTR_PREFIX + name];
  }
}

export function hasAttr(node: FxpNode, name: string): boolean {
  return getAttr(node, name) !== undefined;
}

export function getAttrNames(node: FxpNode): string[] {
  const attrs = node[":@"];
  if (!attrs) return [];
  return Object.keys(attrs)
    .filter((k) => k.startsWith(ATTR_PREFIX))
    .map((k) => k.substring(ATTR_PREFIX.length));
}

export function getAttrsMap(node: FxpNode): Record<string, string> {
  const result: Record<string, string> = {};
  const attrs = node[":@"];
  if (!attrs) return result;
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith(ATTR_PREFIX)) {
      result[k.substring(ATTR_PREFIX.length)] = String(v);
    }
  }
  return result;
}

export function createElement(
  tagName: string,
  attrs?: Record<string, string>,
  children?: FxpNode[],
): FxpNode {
  const node: FxpNode = { [tagName]: children || [] };
  if (attrs && Object.keys(attrs).length > 0) {
    node[":@"] = {};
    for (const [k, v] of Object.entries(attrs)) {
      node[":@"][ATTR_PREFIX + k] = v;
    }
  }
  return node;
}

export function createTextElement(
  tagName: string,
  text: string,
  attrs?: Record<string, string>,
): FxpNode {
  const node = createElement(tagName, attrs, [{ "#text": text }]);
  return node;
}

export function addChild(parent: FxpNode, child: FxpNode, index?: number): void {
  const tag = getTagName(parent);
  if (!tag) return;
  if (!Array.isArray(parent[tag])) parent[tag] = [];
  if (index !== undefined) {
    parent[tag].splice(index, 0, child);
  } else {
    parent[tag].push(child);
  }
}

export function removeChild(parent: FxpNode, child: FxpNode): boolean {
  const tag = getTagName(parent);
  if (!tag || !Array.isArray(parent[tag])) return false;
  const idx = parent[tag].indexOf(child);
  if (idx >= 0) {
    parent[tag].splice(idx, 1);
    return true;
  }
  return false;
}

export function removeChildAt(parent: FxpNode, index: number): boolean {
  const tag = getTagName(parent);
  if (!tag || !Array.isArray(parent[tag])) return false;
  if (index >= 0 && index < parent[tag].length) {
    parent[tag].splice(index, 1);
    return true;
  }
  return false;
}

export function renameElement(node: FxpNode, newTagName: string): void {
  const oldTag = getTagName(node);
  if (!oldTag || oldTag === newTagName) return;
  node[newTagName] = node[oldTag];
  delete node[oldTag];
}

export type WalkCallback = (node: FxpNode, parent: FxpNode | null, index: number) => void | "skip" | "remove";

export function walkElements(
  tree: FxpNode[],
  callback: WalkCallback,
  parent: FxpNode | null = null,
): void {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i];
    const tag = getTagName(node);
    if (!tag) continue;

    const result = callback(node, parent, i);
    if (result === "remove") {
      tree.splice(i, 1);
      i--;
      continue;
    }
    if (result === "skip") continue;

    const children = getChildren(node);
    if (children.length > 0) {
      walkElements(children, callback, node);
    }
  }
}

export function findElements(tree: FxpNode[], tagName: string): FxpNode[] {
  const results: FxpNode[] = [];
  walkElements(tree, (node) => {
    if (getTagName(node) === tagName) results.push(node);
  });
  return results;
}

export function findElementsByPrefix(tree: FxpNode[], prefix: string): FxpNode[] {
  const results: FxpNode[] = [];
  walkElements(tree, (node) => {
    const tag = getTagName(node);
    if (tag.startsWith(prefix + ":")) results.push(node);
  });
  return results;
}

export function findElementsMatching(
  tree: FxpNode[],
  predicate: (tagName: string, node: FxpNode) => boolean,
): FxpNode[] {
  const results: FxpNode[] = [];
  walkElements(tree, (node) => {
    const tag = getTagName(node);
    if (tag && predicate(tag, node)) results.push(node);
  });
  return results;
}

export function findFirstElement(tree: FxpNode[], tagName: string): FxpNode | null {
  let found: FxpNode | null = null;
  walkElements(tree, (node) => {
    if (!found && getTagName(node) === tagName) {
      found = node;
      return "skip";
    }
  });
  return found;
}

export function findFirstElementMatching(
  tree: FxpNode[],
  predicate: (tagName: string, node: FxpNode) => boolean,
): FxpNode | null {
  let found: FxpNode | null = null;
  walkElements(tree, (node) => {
    if (!found) {
      const tag = getTagName(node);
      if (tag && predicate(tag, node)) {
        found = node;
        return "skip";
      }
    }
  });
  return found;
}

export function forEachAttr(
  tree: FxpNode[],
  attrName: string,
  callback: (value: string, node: FxpNode) => string | undefined,
): void {
  walkElements(tree, (node) => {
    const val = getAttr(node, attrName);
    if (val !== undefined) {
      const newVal = callback(val, node);
      if (newVal !== undefined && newVal !== val) {
        setAttr(node, attrName, newVal);
      }
    }
  });
}

export function replaceTagName(
  tree: FxpNode[],
  oldName: string,
  newName: string,
): number {
  let count = 0;
  walkElements(tree, (node) => {
    if (getTagName(node) === oldName) {
      renameElement(node, newName);
      count++;
    }
  });
  return count;
}

export function isSelfClosing(node: FxpNode): boolean {
  const children = getChildren(node);
  return children.length === 0;
}

export function cloneNode(node: FxpNode): FxpNode {
  return JSON.parse(JSON.stringify(node));
}
