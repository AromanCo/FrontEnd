# M6-A28F — Backend Dependency Audit

## Scope and result

This is a read-only static inventory of Frontend baseline `6c69ddb7c001e962f13b21d905785e86bf4168da` and authorized Backend revision `0be24c4597bd693e70348243c26e550a20a8ad0e`. It parses `pyproject.toml`, Frontend CI YAML text, and the Backend Dockerfile without running Python metadata, pip, a resolver, or build commands. The static report is not a resolved environment and does not establish reproducibility.

The Backend checkout is at the configured pin and tracked-clean at audit time. Backend `pyproject.toml` has build requirements but no lock, constraints, index policy, hashes, or resolved dependency closure. The Backend Dockerfile installs version ranges from the project metadata and `setuptools>=75`; the base image is `python:3.12-slim`, a mutable tag. No digest-pinned Python base identity is recorded.

## Declared inventory at the pinned revision

| Group | Declaration | Role and constraints |
|---|---|---|
| Python | `>=3.12` | Lower bound only; project metadata does not cap Python minor releases. Frontend CI selects Python 3.12 for Backend-consuming jobs. |
| Build system | `setuptools>=75`; `setuptools.build_meta` | Range is unresolved. PEP 517 build isolation can acquire build requirements separately from runtime packages. |
| Runtime | `fastapi>=0.115,<1` | Version range; no direct or transitive hashes. |
| Runtime | `uvicorn[standard]>=0.34,<1` | `standard` extra expands the dependency set; platform and Python markers/wheels may affect resolution. |
| Runtime | `pydantic-settings>=2.7,<3` | Version range; transitive closure is not pinned. |
| Runtime | `sqlalchemy>=2.0,<3` | Version range; transitive closure is not pinned. |
| Runtime | `alembic>=1.14,<2` | Version range; transitive closure is not pinned. |
| Runtime | `psycopg[binary]>=3.2,<4` | Binary extra and wheel availability depend on Python ABI, OS, architecture and platform. |
| Development extra `dev` | `pytest>=8,<10`, `httpx>=0.27,<1`, `ruff>=0.9,<1`, `mypy>=1.14,<2` | Optional test/lint/type set; no lock or hashes. `httpx` is also installed explicitly by one Frontend CI job. |

These are the complete static declarations found in the project metadata. They are not exact package versions. The transitive dependencies, selected wheel files, source builds, build isolation requirements and index artifacts remain unknown. A lock-like file, if later added, would still need review and approval before being called authoritative.

## Reproducibility risks

- No `uv.lock`, `poetry.lock`, `Pipfile.lock`, `pdm.lock`, or `requirements*.txt` is tracked at the Backend root. No approved lock identity exists in the M6-A28C example; its Backend lock status/reference are `NOT_CAPTURED`.
- No package hash checking (`--require-hashes` or equivalent) is in current Backend acquisition commands.
- Direct dependency ranges leave the selected versions and transitive closure to the resolver/index state at install time.
- The Frontend CI Python version is pinned to minor `3.12`, not an exact patch build; pip itself and its resolver version are unspecified.
- The Backend Dockerfile uses mutable `python:3.12-slim`, invokes pip without a pinned pip version or hash lock, and resolves `setuptools>=75` separately. The pip cache mount is a performance cache, not a dependency lock.
- `psycopg[binary]` and `uvicorn[standard]` can select platform- and interpreter-specific wheels or source builds. A lock policy must define supported OS/architecture/Python ABI targets and whether wheels only are required.
- Reproducible source metadata does not by itself reproduce an OCI image: base-image digest, OS packages, build frontend/build backend, build environment, wheelhouse/index provenance and build invocation also need identities.

No package versions were resolved or inferred in this audit.

## CI acquisition comparison

The Frontend workflow has five jobs. Three check out the Backend pin and install Python dependencies:

| Frontend job | Backend acquisition | Dependency scope and material difference |
|---|---|---|
| `postgres-real-stack-browser` | Explicit package list | Lists the six runtime package names plus `httpx>=0.27,<1`, but uses plain `uvicorn>=0.34,<1` rather than the declared `uvicorn[standard]` extra. It does not install the Backend project or declare its build-system requirement in the command. |
| `real-stack-browser` | Explicit package list | Omits `psycopg[binary]` and `httpx` from the first job's list and also uses plain `uvicorn` without the declared `standard` extra; it does not install the Backend project or declare the build-system requirement. |
| `exploration-real-stack-browser` | `python -m pip install ./backend-pinned` | Installs the local Backend project and its PEP 621 runtime dependencies; pip may install the declared build-system requirement in an isolated build environment. It does not request the `dev` extra. |

All three select Python `3.12`; none pins the patch version, pip/resolver version, index state, artifact hashes or wheel set. The explicit commands contain version ranges and do not demonstrate a complete runtime resolution. The project-install command has different metadata/build semantics. Therefore equivalence is **not demonstrated** and the methods are a **DRIFT_RISK**. CI success indicates those commands completed in their respective jobs; it does not prove they installed equal dependency closures.

The other two Frontend jobs (`verify` and `exploration-release`) do not check out/install Backend Python dependencies. Node setup is 22 in the relevant workflow jobs; that does not make them Backend dependency consumers.

Backend's own four GitHub Actions jobs (`checks`, `otp-postgres`, `postgres-role-isolation`, and `postgres-backup-restore`) select Python `3.12` and each runs `python -m pip install -e '.[dev]'`. This asks pip to install the local project plus declared runtime and `dev` optional dependencies in editable mode. It still uses mutable ranges and unspecified pip/build tooling without package hashes. The Backend workflow is observed read-only and is not changed by this milestone.

## Future strategy proposal

Use one owner-approved acquisition contract across Backend CI, Frontend integration CI and future images. Generate a reviewed runtime/build lock and separate development/test lock coverage from the exact authorized Backend revision. Pin the resolver/bootstrap version and target matrix. Require hashes for every permitted artifact and build dependency, define platform-specific wheel behavior, and install only from an approved immutable mirror or verified offline wheelhouse. Make each job prove which lock digest it consumed. Keep the image base pinned by OCI digest and separately record OS/build inputs. Until a Backend owner approves the tool and migration, leave the current commands unchanged and mark the environment non-reproducible.

The Backend repository also contains `services/api-gateway/Dockerfile` and `services/product-service/Dockerfile` for separate Go services. They use `go mod download`, `golang:1.21-alpine` build stages and `alpine:latest` runtime tags. They are outside this Python `pyproject.toml` lock inventory; their Go module and image-input reproducibility would need separate review if those services become release inputs. No standalone Backend dependency-installation script was found in the tracked-file inventory; the Python Dockerfile and Backend Actions workflow are the observed acquisition paths.
