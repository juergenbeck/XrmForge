/**
 * @xrmforge/helpers - HTML WebResource context helpers
 *
 * An embedded HTML WebResource (a standalone page in a form IFrame or the
 * sitemap) gets no `executionContext` parameter. It reaches the host form API
 * through `window.parent.Xrm` and reads the hosting record from the parent page
 * context. Both accesses need a cast today (@types/xrm types neither tightly
 * enough): this module encapsulates them once so WebResource code stays cast-free.
 *
 * Browser-safe (zero Node.js dependencies), safe in esbuild IIFE bundles.
 */

/**
 * The host form API of an embedded HTML WebResource, reached via `window.parent`.
 *
 * A WebResource hosted in a form IFrame has no `executionContext`; the form API
 * lives on the parent frame. This encapsulates the
 * `(window.parent as unknown as { Xrm }).Xrm` cast the page would otherwise spell
 * out at every call site.
 *
 * @returns The parent frame's `Xrm` (same shape as the global `Xrm`)
 *
 * @example
 * const xrm = parentXrm();
 * const record = await xrm.WebApi.retrieveRecord(EntityNames.Account, id, select(AccountFields.Name));
 */
export function parentXrm(): typeof Xrm {
  // `window.parent.Xrm` at runtime: in a browser `globalThis === window`, so
  // `globalThis.parent` is `window.parent`. Going through `globalThis` keeps this
  // package free of the DOM lib (only this WebResource helper touches the frame).
  return (globalThis as unknown as { parent: { Xrm: typeof Xrm } }).parent.Xrm;
}

/**
 * The hosting record (entity name + id) of an embedded HTML WebResource.
 *
 * Reads the parent page context and returns the entity name plus the normalized
 * record id (braces stripped, ready for a Web API call). @types/xrm does not type
 * `getPageContext().input` tightly enough for an entity record page, so the cast
 * is encapsulated here once.
 *
 * @returns `{ entityId, entityName }` - both `''` when the parent page context
 *   carries no entity record (e.g. the WebResource is opened standalone)
 *
 * @example
 * const { entityId, entityName } = getWebResourceContext();
 * if (entityId) {
 *   const record = await parentXrm().WebApi.retrieveRecord(entityName, entityId, select(...));
 * }
 */
export function getWebResourceContext(): { entityId: string; entityName: string } {
  const input = parentXrm().Utility.getPageContext().input as {
    entityName?: string;
    entityId?: string;
  };
  return {
    entityId: (input?.entityId ?? '').replace(/[{}]/g, ''),
    entityName: input?.entityName ?? '',
  };
}
