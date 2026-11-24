CREATE TYPE "session_channel" AS ENUM ('web', 'mobile');

ALTER TABLE "sessions" ADD COLUMN "channel" "session_channel" NOT NULL DEFAULT 'web';
