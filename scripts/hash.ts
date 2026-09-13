/**
 * Generates argon2id hashes for the two role passwords (PLAN.md §3).
 *
 *   npm run hash -- "her password" "my password"
 *
 * Paste the output into .env.local locally, or Portainer's Environment
 * variables panel in production. Plaintext never touches the repo or the DB.
 */
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";

async function main() {
  const [artistPw, adminPw] = process.argv.slice(2);

  if (!artistPw) {
    console.error('usage: npm run hash -- "<artist password>" ["<admin password>"]');
    process.exit(1);
  }

  const artistHash = await hash(artistPw);
  const adminHash = adminPw ? await hash(adminPw) : null;

  /*
   * In a .env file every `$` MUST be backslash-escaped.
   *
   * Next runs dotenv-expand over .env files, and an argon2 hash is full of $
   * segments ($argon2id$v=19$m=...). Unescaped, they expand to nothing: the
   * value arrives ~38 chars long with every $ gone, argon2 throws "Decoding
   * failed", and login fails with no visible reason. Quoting does NOT help —
   * dotenv strips the quotes and expands anyway. Only `\$` survives.
   *
   * Portainer's env panel stores literals and performs no expansion, so paste
   * the RAW value there instead.
   */
  const esc = (s: string) => s.replace(/\$/g, "\\$");
  /*
   * Docker Compose interpolates $NAME in the YAML it is handed, and an argon2
   * hash is nothing but $ segments: $argon2id, $v, $m, then the salt and the
   * digest. Unescaped, each is substituted with an empty string and a 97-char
   * hash reaches the container as 44. $$ is the literal-dollar escape.
   *
   * This bit us in production. The failure is silent and looks exactly like a
   * wrong password: a malformed hash makes verify() throw, safeVerify()
   * swallows it, and the route answers 401.
   */
  const compose = (s: string) => s.split("$").join("$$");

  console.log("\n# --- docker-compose / Portainer stack YAML ($$ escaped) ---");
  console.log(`ARTIST_PASSWORD_HASH=${compose(artistHash)}`);
  if (adminHash) console.log(`ADMIN_PASSWORD_HASH=${compose(adminHash)}`);

  console.log("\n# --- .env.local (dollar signs escaped, keep them) ---");
  console.log(`SESSION_SECRET=${randomBytes(32).toString("hex")}`);
  console.log(`ARTIST_PASSWORD_HASH=${esc(artistHash)}`);
  if (adminHash) console.log(`ADMIN_PASSWORD_HASH=${esc(adminHash)}`);

  console.log("\n# --- Portainer env panel (raw, NO backslashes) ---");
  console.log(`ARTIST_PASSWORD_HASH  ${artistHash}`);
  if (adminHash) console.log(`ADMIN_PASSWORD_HASH   ${adminHash}`);
  console.log("# ---------------------------------------------------\n");

  if (adminPw && adminPw === artistPw) {
    console.error("WARNING: both passwords are identical — the password IS the role, so");
    console.error("         you would only ever be able to log in as one of them.\n");
  }
}

void main();
