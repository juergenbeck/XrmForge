# 12. @types/xrm-Fallstricke

Bekannte Probleme bei der Arbeit mit `@types/xrm`:

| Problem | Falsch | Richtig |
|---------|--------|---------|
| Form-Interface | `interface extends Xrm.FormContext` | `extends Omit<Xrm.FormContext, 'getAttribute' \| 'getControl'>` |
| AlertDialogResponse | `Xrm.Navigation.AlertDialogResponse` | `Xrm.Async.PromiseLike<void>` (Typ existiert nicht) |
| ConfirmDialogResponse | `Xrm.Navigation.ConfirmDialogResponse` | `Xrm.Navigation.ConfirmResult` (Typ existiert nicht) |
| setNotification | `setNotification(message)` | `setNotification(message, uniqueId)` (erfordert 2 Argumente) |
| openFile | `openFile({ fileName, ... })` | Muss `fileSize`-Eigenschaft in FileDetails enthalten |
| SubmitMode | `Xrm.Attributes.SubmitMode` | `Xrm.SubmitMode` |
| const enum in .d.ts | `const enum` in `.d.ts`-Dateien | Reguläres `enum` in `.ts`-Dateien verwenden (vitest kann const enums aus .d.ts nicht importieren) |
| Grid.refresh() | `grid.refresh()` | `(grid as any).refresh()` (nicht typisiert in @types/xrm) |
