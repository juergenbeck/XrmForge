import { describe, it, expect } from 'vitest';
import { FastXmlParser } from '../src/metadata/xml-parser.js';
import type { XmlParser, XmlElement } from '../src/metadata/xml-parser.js';

const parser = new FastXmlParser();

// ─── Basic Parsing ───────────────────────────────────────────────────────────

describe('FastXmlParser', () => {
  it('should parse a simple element', () => {
    const result = parser.parse('<root/>');
    expect(result.tag).toBe('root');
    expect(result.children).toHaveLength(0);
    expect(result.attributes).toEqual({});
  });

  it('should parse element with attributes', () => {
    const result = parser.parse('<control id="name" classid="{GUID}" datafieldname="name" />');
    expect(result.tag).toBe('control');
    expect(result.attributes['id']).toBe('name');
    expect(result.attributes['classid']).toBe('{GUID}');
    expect(result.attributes['datafieldname']).toBe('name');
  });

  it('should parse nested elements', () => {
    const xml = '<form><tabs><tab name="TAB1"><section name="SEC1"/></tab></tabs></form>';
    const result = parser.parse(xml);

    expect(result.tag).toBe('form');
    expect(result.children).toHaveLength(1);

    const tabs = result.children[0]!;
    expect(tabs.tag).toBe('tabs');

    const tab = tabs.children[0]!;
    expect(tab.tag).toBe('tab');
    expect(tab.attributes['name']).toBe('TAB1');

    const section = tab.children[0]!;
    expect(section.tag).toBe('section');
    expect(section.attributes['name']).toBe('SEC1');
  });

  it('should handle deeply nested elements (8+ levels)', () => {
    const xml = '<a><b><c><d><e><f><g><h name="deep"/></g></f></e></d></c></b></a>';
    const result = parser.parse(xml);

    // Navigate 8 levels deep
    let current = result;
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (const expectedTag of tags) {
      expect(current.tag).toBe(expectedTag);
      if (expectedTag !== 'h') {
        expect(current.children.length).toBeGreaterThanOrEqual(1);
        current = current.children[0]!;
      }
    }
    expect(current.attributes['name']).toBe('deep');
  });

  it('should handle multiple sibling elements', () => {
    const xml = '<root><child name="a"/><child name="b"/><child name="c"/></root>';
    const result = parser.parse(xml);

    expect(result.children).toHaveLength(3);
    expect(result.children[0]!.attributes['name']).toBe('a');
    expect(result.children[1]!.attributes['name']).toBe('b');
    expect(result.children[2]!.attributes['name']).toBe('c');
  });

  it('should handle empty XML string gracefully', () => {
    // fast-xml-parser returns empty result for empty string
    const result = parser.parse('');
    expect(result).toBeDefined();
  });

  it('should handle attributes with special characters', () => {
    const xml = '<control id="field_1" classid="{4273EDBD-AC1D-40D3-9FB2-095C621B552D}" />';
    const result = parser.parse(xml);
    expect(result.attributes['classid']).toBe('{4273EDBD-AC1D-40D3-9FB2-095C621B552D}');
  });

  it('should handle attributes in any order', () => {
    // Attribute order should not matter
    const xml1 = '<control id="x" datafieldname="name" classid="{G}" />';
    const xml2 = '<control datafieldname="name" classid="{G}" id="x" />';

    const r1 = parser.parse(xml1);
    const r2 = parser.parse(xml2);

    expect(r1.attributes['datafieldname']).toBe('name');
    expect(r2.attributes['datafieldname']).toBe('name');
    expect(r1.attributes['id']).toBe('x');
    expect(r2.attributes['id']).toBe('x');
  });
});

// ─── XmlParser Interface ─────────────────────────────────────────────────────

describe('XmlParser interface', () => {
  it('should allow custom parser implementation', () => {
    const mockParser: XmlParser = {
      parse(_xml: string): XmlElement {
        return {
          tag: 'mock-root',
          attributes: { injected: 'true' },
          children: [],
        };
      },
    };

    const result = mockParser.parse('<anything/>');
    expect(result.tag).toBe('mock-root');
    expect(result.attributes['injected']).toBe('true');
  });
});
