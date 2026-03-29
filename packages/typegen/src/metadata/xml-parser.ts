/**
 * @xrmforge/typegen - XML Parser Abstraction
 *
 * Interface for XML parsing, decoupled from any specific parser library.
 * Allows swapping the underlying parser (currently fast-xml-parser)
 * by implementing a single interface. (Goldene Regel 14)
 */

// ─── Parser Interface ────────────────────────────────────────────────────────

/**
 * Parsed XML element with attributes and children.
 */
export interface XmlElement {
  /** Element tag name */
  tag: string;
  /** Element attributes as key-value pairs */
  attributes: Record<string, string>;
  /** Child elements */
  children: XmlElement[];
  /** Text content (if any) */
  text?: string;
}

/**
 * Abstraction for XML parsing. Implementations must convert an XML string
 * into a tree of XmlElement objects.
 *
 * To swap the underlying parser library, implement this interface
 * and pass it to the FormXml parser. Only this file needs to change.
 */
export interface XmlParser {
  parse(xml: string): XmlElement;
}

// ─── fast-xml-parser Implementation ──────────────────────────────────────────

import { XMLParser } from 'fast-xml-parser';

/**
 * XML parser implementation using fast-xml-parser.
 * Zero dependencies (fast-xml-parser itself has none), 26 KB minified.
 */
export class FastXmlParser implements XmlParser {
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      preserveOrder: true,
      trimValues: true,
    });
  }

  parse(xml: string): XmlElement {
    const result = this.parser.parse(xml);
    return this.convertToXmlElement(result);
  }

  private convertToXmlElement(parsed: unknown): XmlElement {
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { tag: 'root', attributes: {}, children: [] };
    }

    // fast-xml-parser with preserveOrder returns an array of objects
    // Each object has one key (the tag name) and optionally :@_attrs
    const children = parsed.map((item: Record<string, unknown>) => this.convertNode(item));

    if (children.length === 1) {
      return children[0]!;
    }

    return { tag: 'root', attributes: {}, children };
  }

  private convertNode(node: Record<string, unknown>): XmlElement {
    const attrs: Record<string, string> = {};
    let tag = '';
    let children: XmlElement[] = [];
    let text: string | undefined;

    for (const key of Object.keys(node)) {
      if (key === ':@') {
        // Attributes object
        const attrObj = node[key] as Record<string, string>;
        for (const [attrKey, attrVal] of Object.entries(attrObj)) {
          // Remove the @_ prefix added by fast-xml-parser
          const cleanKey = attrKey.startsWith('@_') ? attrKey.slice(2) : attrKey;
          attrs[cleanKey] = String(attrVal);
        }
      } else if (key === '#text') {
        text = String(node[key]);
      } else {
        tag = key;
        const childContent = node[key];
        if (Array.isArray(childContent)) {
          children = childContent.map((child: Record<string, unknown>) => this.convertNode(child));
        }
      }
    }

    return { tag, attributes: attrs, children, text };
  }
}

// ─── Default Instance ────────────────────────────────────────────────────────

/** Default parser instance. Use this unless you need a custom parser. */
export const defaultXmlParser: XmlParser = new FastXmlParser();
