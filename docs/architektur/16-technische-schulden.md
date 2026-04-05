# 16. Technische Schulden

## 16.1 Bekannte Probleme

| Problem | Status | Priorität |
|---------|--------|-----------|
| parseLookup/select wird von KI-Assistenten nicht übernommen | Offen | Hoch |
| release.yml doppelte Ausführungen (CI löst Release aus, Release löst CI erneut aus) | Offen | Niedrig |
| Keine Integrationstests gegen Live-Dataverse | Offen (OE-4) | Mittel |
| @xrmforge/webapi hat keine Action/Function-Unterstützung | Akzeptiert | Niedrig |
| devDependency-Versionen im generierten package.json sind auf alte Versionen fixiert | Offen | Niedrig |

## 16.2 Akzeptierte Einschränkungen

- **const-enum-Einschränkung:** Gelöst in typegen 0.8.0. Generierter Output sind jetzt `.ts`-ES-Module, sodass `const enum` direkt mit vitest und anderen Test-Frameworks funktioniert.
- **Grid.refresh() erfordert `as any`:** Nicht typisiert in @types/xrm.
- **Eine Solution pro Entität:** Wenn eine Entität in mehreren Solutions vorkommt, wird sie nur einmal generiert.
