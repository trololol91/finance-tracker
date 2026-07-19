-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" UUID NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "token_endpoint_auth_method" TEXT NOT NULL DEFAULT 'none',
    "grant_types" TEXT[] DEFAULT ARRAY['authorization_code']::TEXT[],
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_authorization_codes" (
    "id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scopes" TEXT[],
    "code_challenge" TEXT NOT NULL,
    "code_challenge_method" TEXT NOT NULL DEFAULT 'S256',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_clients_client_id_key" ON "oauth_clients"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_authorization_codes_code_hash_key" ON "oauth_authorization_codes"("code_hash");

-- CreateIndex
CREATE INDEX "oauth_authorization_codes_user_id_idx" ON "oauth_authorization_codes"("user_id");

-- AddForeignKey
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE RESTRICT ON UPDATE CASCADE;
