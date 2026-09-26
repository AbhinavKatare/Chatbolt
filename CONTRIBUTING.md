# Contributing to Chatbolt

Thank you for your interest in contributing to Chatbolt! We welcome community contributions to fix bugs, improve documentation, add adapters, and enhance the core platform.

---

## 1. Source-Available Licensing & Contributor Agreement (CLA)

Chatbolt is distributed under the **Business Source License 1.1 (BUSL-1.1)**, converting to **Apache License 2.0** on `2030-01-01`.

By submitting a Pull Request, issue patch, or code contribution to this repository, you agree to the following terms:

1. **Grant of Rights**: You grant Chatbolt Inc. a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense, and distribute your contributions and such derivative works.
2. **Relicensing & Dual-Licensing**: You acknowledge and agree that Chatbolt Inc. retains the full right to license, dual-license, or relicense the project (including your contributions) under source-available, open-source (e.g. Apache 2.0), or commercial enterprise terms.
3. **Original Work & Authority**: You represent that you are legally entitled to grant this license and that each of your contributions is your original creation (or submitted with full permission of the copyright holder).

---

## 2. Development Workflow

### Prerequisites
- Node.js 18+ & npm
- Python 3.10+ (for `agent-brain`)
- Go 1.21+ (for `agent-runtime`)
- PostgreSQL or local test mock

### Local Setup
```bash
# 1. Install Node backend dependencies
cd chatai-backend
npm install

# 2. Setup Python reasoning environment
cd ../agent-brain
python -m venv venv
venv\Scripts\pip install -r requirements.txt

# 3. Run full test suite
cd ../chatai-backend
npm test
```

---

## 3. Code Standards & Architecture

1. **Open Core vs Enterprise**:
   - Generic runtime, agent bus, base tools, and local concurrency belong in `core/` / open backend packages.
   - Proprietary billing adapters, enterprise SSO, and closed integrations belong in `enterprise/`.
2. **Security & Sandbox Isolation**:
   - All mutating commands and code executions must pass through the sandboxed runtime in Go (`agent-runtime`), never raw Node `child_process`.
   - Never log decrypted credentials or persist user secrets in unencrypted form.
3. **Test Coverage**:
   - Any new feature or bugfix must include corresponding automated unit/integration tests (`npm test` and `pytest`).

---

## 4. Legal Review Advisory

> [!NOTE]
> All changes affecting licensing, third-party dependencies, or trademark policies must be flagged for review by project maintainers and qualified legal counsel before production release.
