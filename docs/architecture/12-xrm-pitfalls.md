# @types/xrm Pitfalls

Known issues when working with `@types/xrm`:

| Issue | Wrong | Correct |
|-------|-------|---------|
| Form interface | `interface extends Xrm.FormContext` | `extends Omit<Xrm.FormContext, 'getAttribute' \| 'getControl'>` |
| AlertDialogResponse | `Xrm.Navigation.AlertDialogResponse` | `Xrm.Async.PromiseLike<void>` (type does not exist) |
| ConfirmDialogResponse | `Xrm.Navigation.ConfirmDialogResponse` | `Xrm.Navigation.ConfirmResult` (type does not exist) |
| setNotification | `setNotification(message)` | `setNotification(message, uniqueId)` (requires 2 args) |
| openFile | `openFile({ fileName, ... })` | Must include `fileSize` property in FileDetails |
| SubmitMode | `Xrm.Attributes.SubmitMode` | `Xrm.SubmitMode` |
| const enum in .d.ts | `const enum` in `.d.ts` files | Use regular `enum` in `.ts` files (vitest cannot import const enums from .d.ts) |
| Grid.refresh() | `grid.refresh()` | `(grid as any).refresh()` (not typed in @types/xrm) |
