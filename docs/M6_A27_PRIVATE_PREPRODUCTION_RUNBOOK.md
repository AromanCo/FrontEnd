# M6-A27 Private Preproduction Operator Handoff

**Review-only handoff. No deployment, provisioning, server access, spend, Nginx, Docker, firewall, or database change was performed.** The supplied Afra measurements are historical snapshots, not verified target evidence. This document supplements M6-A23 and M6-A25 procedures; those remain the controlling target-evidence and public-release gates.

## Scope and boundaries

The owner-selected planning direction is Architecture A: an isolated AROMAN project on the existing Afra host in Iran, with a proposed root-disk target near 80 GiB. This is planning only. The disk quote, spending approval, and any target implementation authorization are separate prerequisites. The pinned Backend target is `aroman.exploration_api:app`, the catalog-only FastAPI boundary. The full `aroman.main:app` must never be used by this showcase.

The public artifact remains `AROMAN_RELEASE_SCOPE=public-showcase` and `NEXT_PUBLIC_AROMAN_API_BASE_URL=/api/v1`. The server-only `AROMAN_CATALOG_UPSTREAM_URL` is fixed to `http://catalog-api:8000/api/v1`. The existing Frontend proxy permits exactly five catalog GET templates: brands, products, product variants, fragrance families, and fragrance notes. No parallel public API is introduced.

Include the Persian-first responsive catalog and the existing Guided Studio, Creative Studio, and conceptual Smart Perfumer views. No login, accounts, OTP or real SMS, user persistence, saved concepts, orders, checkout, or payments. Only content with a completed rights review may be published. The formal D1–D12 JSON stays OPEN; D1–D3 owner-selected planning directions do not create approval timestamps or resolve those formal decisions. D4–D12 remain OPEN. D9 and D12 remain out of initial implementation and still need explicit disposition for any eventual public release.

## Protected workloads and historical ports

Never modify, stop, remove, rebuild, reconnect, or clean resources belonging to Pazhoochi; the AROMAN coming-soon site and database; Zarbin services and PostgreSQL; Rond Bot services, PostgreSQL and Redis; Xray; or other existing services. Do not run Docker cleanup commands.

The supplied snapshot reports 19% inode use and lists published ports 5432 (Zarbin PostgreSQL), 8123 (Zarbin API), 8000 (Rond Bot API), 3008 (Rond Bot admin), 3027 (AROMAN coming-soon), and 8443 (Xray). Ports 3001 and 8027 were reported as localhost-only. These are historical observations only. The server also had Nginx and UFW active, with 16 running containers and no explicit CPU/memory limits on existing containers. Listening addresses and firewall output alone do not prove reachability or isolation.

## Approval-gated verification sequence

Every live command below is **APPROVAL-GATED and NOT EXECUTED**. It may be run only by a separately authorized operator after the exact target, read-only scope, evidence handling, and change window are approved. Capture sanitized output; do not paste secrets, IPs, provider credentials, or sensitive container environment into repository evidence.

1. **Capacity and protected-service inventory.** Check CPU count, memory and swap, root free space and inode use, Docker image/volume/build-cache usage, workload inventory, resource limits, and every published port. Reconcile the inventory with the protected services above. Do not infer 80 GiB is available until a separately approved purchase is completed and measured.

   **APPROVAL-GATED — NOT EXECUTED (read-only target inspection):**

   ```sh
   nproc
   free -h
   df -h /
   df -i /
   docker ps --no-trunc --format '{{.Names}} {{.Image}} {{.Ports}}'
   docker system df -v
   ss -lntup
   ```

   Supply sanitized measurements to `scripts/assess-afra-capacity.mjs`. Resolve every `BLOCKED` result. `UNVERIFIED` capacity, image/cache growth, logs, backups, or port inventory cannot be assumed safe. No automatic cleanup of existing Docker data is permitted.

2. **Artifact, secret ownership, and rendered configuration.** Use an M6-A25 candidate built once from the exact Frontend source revision and Backend pin. `scripts/prepare-private-candidate.mjs` reuses the existing immutable candidate verifier and fills only verified source/artifact identity slots; it keeps every target control `UNVERIFIED` and public release `NO-GO`. Verify source-tree integrity, public-showcase build metadata, compiled artifact digest, image digests, and the Backend pin. The Frontend image Dockerfile packages that verified `.next` candidate and required runtime files; its custom build ignore admits only those files. The catalog image Dockerfile builds from the clean pinned Backend checkout and defaults to `aroman.exploration_api:app`; its custom build ignore excludes tests and repository metadata. Supply digest-pinned Node 22+ and Python 3.12+ base images, build each artifact in the approved controlled build process, and record the final images by digest. These image builds were not run here.

   Create the secret directory outside the repository as `root:root` mode `0700`. It must contain only these seven files, each owned by `root:10001` mode `0440`: `catalog_runtime_database_url`, `catalog_migration_database_url`, `database_bootstrap_password`, `catalog_migration_password`, `catalog_runtime_password`, `otp_pepper`, and `session_pepper`. No symlinks, additional files, group/other directory access, or group/other file access are accepted. Compose file-backed secrets preserve bind-mounted host ownership and permissions; do not rely on Compose `uid`, `gid`, or `mode` attributes to remap them. UID/GID `10001:10001` can read its secret files through the assigned group, while the host directory remains root-only. Keep all seven values synthetic in local tests and real values outside Git. The pinned Backend requires distinct OTP/session peppers even though those routes are absent from this restricted application.

   The host validator reads private files, so run it with sufficient local privilege to traverse the root-only directory. Use `node scripts/test-private-secret-readability.local.mjs` with a cached `node:24-alpine` image to verify UID/GID `10001:10001` access to the intended synthetic files. The custom PostgreSQL image built from `Dockerfile.database` adds the same secret-reader group to the `postgres` OS account so the official entrypoint can read its initialization secrets after dropping root. The validator checks parent and file owner/group/mode, exact inventory, path, role/database identity, password match, strength, and distinctness without printing contents. Require an exact owner-approved HTTPS CORS origin for the Backend settings. The template refuses missing image digests, CORS configuration, host port, or secret-file references.

   Render the full Compose model locally with synthetic values and inspect it with `scripts/validate-private-compose.mjs`. On a future authorized target, repeat effective rendering after all approved overrides and check the resulting digest. Review every service, profile, image, secret source, network, resource limit, mount, port, restart rule, command, and health check. Build the custom PostgreSQL image from a digest-pinned official PostgreSQL Alpine base using `Dockerfile.database`; record the resulting image by digest. PostgreSQL keeps `cap_drop: ALL` and adds only `CHOWN` for socket/data ownership, `SETGID` and `SETUID` for the official entrypoint's permanent root drop, and `DAC_READ_SEARCH` for inspection of the mode-0700 data directory on fresh initialization and restart. The cached-image capability matrix verified each as required; `FOWNER`, `DAC_OVERRIDE`, and broader capabilities are rejected. Any override or unknown image provenance stops the release.

   **APPROVAL-GATED — NOT EXECUTED (read-only target rendering; not a deployment command):**

   ```sh
   docker compose --profile controlled-migration -f /approved/path/compose.yaml config --format json
   ```

3. **Network, routing, and conflict review.** Confirm only project-scoped `aroman_catalog` and `aroman_database` networks exist, both internal. Only Frontend port 3000 may be published, bound to IPv4 loopback `127.0.0.1`; choose an unused port after target inventory and Nginx review. Backend and PostgreSQL publish no host ports. Neither host networking nor unrelated networks are allowed. The only repository file mounts are the two fixed, read-only Compose configs for fresh database role bootstrap and the controlled post-migration grant; the validator fixes both source paths. No other host bind is allowed. Confirm Nginx does not collide with the AROMAN coming-soon hostname, routes, upstream, or port. Future Nginx changes need separate approval.

   Inspect effective Docker/UFW behavior for IPv4 and IPv6: Docker NAT/filter chains, forwarding policy, UFW effective rules, container-to-container boundaries, host loopback behavior, and authorized reachability checks from an approved vantage point. Existing firewall rules restricting some PostgreSQL traffic do not prove full IPv4/IPv6 isolation. Do not run a public scan or probe without an exact separate authorization.

4. **Database, migration, backup, and restore.** Confirm a fresh isolated `aroman` database volume and distinct bootstrap, `aroman_migrator`, and `aroman_app` identities. Start only the isolated database first and wait for its TCP readiness check; the fresh volume's init script creates separate roles, assigns database ownership to the migrator, revokes public connect, grants runtime CONNECT/schema USAGE, and explicitly revokes default table privileges. Run the controlled migration job once in an approved window. It applies Alembic, then connects as `aroman_migrator`, revokes runtime table/sequence privileges, and grants SELECT only on `brands`, `fragrance_families`, `fragrance_notes`, `products`, and `product_variants`. New tables receive no automatic runtime grant. Stop if migration or grants fail. Start the restricted API and Frontend only after this job succeeds; do not start all services together against an empty schema. Inspect actual effective grants and prove runtime INSERT/UPDATE/DELETE/DDL plus SELECT on users, auth, concept, and migration tables fail. Any schema change to the catalog allowlist requires a reviewed source change and new immutable candidate. Do not run the Backend's broader `grant_app_role.py` for this read-only API.

   Only after approved backup/recovery prerequisites, run the migration job once in a controlled window using the separate migration URL secret. Verify the exact Alembic revision and owner-approved schema identity. The `controlled-migration` profile is deliberately excluded from normal service startup. Require a successful isolated backup and a separately rehearsed restore before any retained catalog data is accepted. Record backup references, retention, encryption/key custody, and owner-approved numeric RPO/RTO. A cached-image-only fresh-volume lifecycle check can be run locally with `node scripts/test-private-postgres-runtime.local.mjs`; it uses synthetic credentials, an anonymous disposable volume, no network, and no published port.

5. **Private smoke and rights review.** Through only the approved private Nginx path, verify Frontend readiness and the five allowed GET templates. Verify unsupported paths/methods, direct Backend requests, public API/database ports, auth/OTP/user/concept/order/checkout/payment features, and origin bypasses fail. Confirm sanitized logs and alerts, secret separation, monitoring delivery, incident escalation, and rollback authority. Review every catalog row, image, font, label, translation, and claim against the controlled content-rights register before publication.

6. **Independent review and stop/rollback.** A separate reviewer checks source and image identity, effective Compose digest, grant results, network evidence, backup/restore evidence, content rights, monitoring, and all 13 M6-A23 controls. All 13 production target controls remain `UNVERIFIED` until actual evidence is collected and independently reviewed. Any unresolved required owner decision, missing quote/spending authority, candidate mismatch, unknown secret provenance, extra route, writable runtime grant, network bypass, port conflict, failed migration/restore/alert, content-rights gap, or unexpected workload impact is an immediate stop condition.

   On failure, do not improvise database downgrades or destructive cleanup. The authorized release/recovery owner chooses between retaining the previous approved artifact, isolating traffic, a reviewed forward fix, or the owner-approved restore path after schema compatibility is checked. Preserve protected workloads. Require a second-person review and explicit owner signoff for any later target action. Public exposure additionally remains blocked by the M6-A25 gate until all applicable D1–D12 decisions, all 13 production controls, independent review, content-rights approvals, and actual owner GO are recorded.

## Current concrete blockers

- No approved restricted Backend artifact digest, Frontend container artifact, PostgreSQL artifact digest, external secrets, approved HTTPS origin, or final effective Compose digest is recorded.
- No completed immutable candidate exists for this branch; use the existing M6-A25 integrity mechanism and preserve its requirements.
- Disk usage by images, volumes, and build cache plus release, database, log, backup, and rollback growth estimates are unknown. Historical 37 GiB/12 GiB-free values cannot establish sufficient headroom; 80 GiB is planned only.
- D4–D12, database/backup/operations assignments, content-rights approvals, and target network/Nginx evidence remain outstanding. D1–D3 planning directions remain formally OPEN.
- No deployment, provisioning, procurement, external probe, or production acceptance is authorized by this handoff.
