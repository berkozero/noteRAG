# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Email and password authentication (backend and frontend).
- End-to-end tests for user flows including registration, login, note management, search, and query.
- Centralized test directory structure (`tests/backend`).
- Basic CHANGELOG.md file.

### Changed
- Refactored backend search and query endpoints for user isolation and authentication requirement.
- Renamed backend files (`core.py` -> `rag_core.py`, `user.py` -> `auth.py`).
- Renamed frontend files (`pages/Login/index.js` -> `pages/LoginPage.js`, `services/auth/index.js` -> `services/authService.js`).
- Updated `README.md` significantly to reflect current project state.
- Updated `docs/OAUTH_SETUP_GUIDE.md` for web application setup.
- Updated various import paths due to refactoring.
- Replaced deprecated `datetime.utcnow()` and `.dict()` calls in Python code.

### Removed
- Redundant backend search endpoint (`/api/notes/search`).
- Old/unused server scripts (`server_https.py`, `https_server_manager.py`, `start_server.py`).
- Old/unused build/test scripts (`api-test.js`, `build.js`, `package-extension.js`, `webpack.prod.js`).
- Old/unused data/config files (`notes.json`, `install.sh`).
- Outdated `docs/HTTPS.md` file.

### Fixed
- Test isolation issues in E2E tests by adding data cleanup fixture.
- Various import errors after refactoring. 