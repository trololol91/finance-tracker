-- Remove duplicate (user_id, fitid) rows introduced by the pending-hash bug,
-- keeping the most recently created record for each duplicate group.
DELETE FROM "transactions"
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, fitid
                   ORDER BY created_at DESC, id DESC
               ) AS rn
        FROM "transactions"
        WHERE fitid IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Partial unique index: enforce one fitid per user when fitid is not null.
-- NULL fitids (manually created transactions) are exempt and may coexist freely.
CREATE UNIQUE INDEX "transactions_user_id_fitid_unique"
    ON "transactions" ("user_id", "fitid")
    WHERE "fitid" IS NOT NULL;
