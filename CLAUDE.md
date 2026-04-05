# MPG Project Notes

## Pending tasks — run at session start

### Firestore patches (blocked by quota, retry automatically)

Run these two scripts in order. If quota is exhausted, inform the user and skip.

```bash
node scripts/patch-mercato-nationalite.cjs
node scripts/patch-mercato-prenom.cjs
```

These patch the Ligue 1 #5 Tour 1 documents (and Tour 2 for prenom) that were imported without `nationalite` / `prenom` fields.
Quota resets daily at ~8h France time. Once both succeed, remove this section.
