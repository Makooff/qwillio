# Skill: tdd-workflow
# Test-Driven Development — tests d'abord, code ensuite

## Trigger
Test, TDD, coverage, spec, feature, bug fix, "écrire les tests", "ajouter un test"

## Workflow obligatoire

### Cycle Red → Green → Refactor

**1. RED — écrire le test qui échoue**
- Écrire UN test pour le comportement attendu
- Le test DOIT échouer (sinon le test est inutile)
- Nommer le test clairement: `should [comportement] when [condition]`

**2. GREEN — écrire le minimum de code pour passer**
- Pas de code anticipatoire
- Pas de généralisation prématurée
- Juste assez pour que le test passe

**3. REFACTOR — nettoyer sans casser**
- Supprimer la duplication
- Améliorer les noms
- Les tests doivent toujours passer après refactor

### Principes

**Tests unitaires**
- Une assertion par test (idéalement)
- Isoler les dépendances (mock/stub ce qui est externe)
- Tests rapides < 100ms chacun
- Pas de logique dans les tests (pas de if/for)

**Tests d'intégration**
- Tester les chemins critiques end-to-end
- Pas de mock pour les DB/services testés ensemble
- Données de test isolées (factories, fixtures)

**Nommage**
```
describe('UserService', () => {
  describe('createUser', () => {
    it('should return user with id when email is valid', ...)
    it('should throw ValidationError when email is missing', ...)
    it('should throw DuplicateError when email already exists', ...)
  })
})
```

**Coverage**
- Lignes critiques: 90%+
- Helpers/utils: 80%+
- Ne pas chasser le 100% — couvrir les cas importants

### Quand NE PAS écrire les tests d'abord
- Exploration/prototypage (écrire tests après stabilisation)
- Code généré (UI scaffolding, migrations auto)
- Scripts one-shot
