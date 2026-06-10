# Prisma migrations

This project historically used `prisma db push` (no migration history). That is
unsafe on a 76-model production database: no history, silent schema drift, and
data-loss risk on column changes.

`0_init` is the **baseline** — a snapshot of the current schema. The production
database already contains these tables, so the baseline must be marked as
*already applied* (never re-run) before switching to migrations.

## One-time setup on production (run once, by a human)

> Take a database snapshot in Neon first.

```bash
# Mark the existing schema as already migrated — does NOT touch data.
DATABASE_URL="<prod>" npx prisma migrate resolve --applied 0_init
```

After this, the history is in sync with the live DB.

### Then switch the deploy command (render.yaml)

`render.yaml` currently runs on every deploy:

```yaml
preDeployCommand: npx prisma db push --accept-data-loss || true
```

This is dangerous: `--accept-data-loss` can drop columns/data on drift, and
`|| true` hides failures. After the baseline resolve above, change it to:

```yaml
preDeployCommand: npx prisma migrate deploy
```

`migrate deploy` is idempotent, applies only pending migrations, and fails loud
(no `|| true`) so a bad migration blocks the deploy instead of corrupting data.

## Going forward

```bash
# Local: create a new migration from a schema change
npm run db:migrate           # prisma migrate dev --name <change>

# Production/CI deploy: apply pending migrations (idempotent, no prompts)
DATABASE_URL="<prod>" npx prisma migrate deploy
```

`prisma db push` should no longer be used against production.

## Regenerating the baseline (only if 0_init is wrong, before prod baseline)

```bash
npx prisma migrate diff --from-empty \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/0_init/migration.sql
```
