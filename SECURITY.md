# Security Policy

The BattleBox team takes the security of our real-time multiplayer platform seriously. This document outlines our security features, supported versions, and the process for reporting vulnerabilities.

---

## Supported Versions

Only the latest release version on the `main` branch receives active security updates and vulnerability patches.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability or security flaw in BattleBox, please notify us responsibly.

### Disclosure Process
1. **Do not create a public GitHub issue** for undisclosed security vulnerabilities.
2. Email your findings to the repository maintainers or submit a private vulnerability disclosure via GitHub Security Advisories.
3. Include detailed steps to reproduce the issue, proof of concept (PoC), and affected components.

### What to Expect
- **Response Time**: We acknowledge receipt of vulnerability reports within 48 hours.
- **Triage & Status**: We will provide updates on fix progress and estimated release timelines.
- **Public Disclosure**: Once a fix is verified and deployed, a public release note and advisory will be published crediting your research.

---

## Built-In Security Architecture

BattleBox implements defense-in-depth measures across the server and game module layers:

### 1. HTTP Security Headers
- Integrated with [Helmet.js](https://helmetjs.github.io/) to enforce Content Security Policy (CSP), prevent clickjacking (`X-Frame-Options`), disable MIME sniffing, and block cross-site scripting (XSS).

### 2. Socket.IO Origin Restrictions
- WebSocket connections enforce strictly configured CORS origins defined via `ALLOWED_ORIGIN` environment variable.

### 3. Server-Side Secret Isolation
- Game answers, secret targets, and color values (e.g. Trivia answers, Number Hunt target, Stroop color answers) are maintained strictly server-side and **never broadcast** in client state updates.

### 4. Privacy Protection & Socket ID Stripping
- Room player lists (`safePlayerList`) strip internal Socket.IO connection IDs before broadcasting to room members to prevent session mapping or socket impersonation.

### 5. IP-Based Sliding Rate Limiter
- Protects against connection spam and event flooding. Keyed on client IP address with sliding window tracking and periodic memory pruning.

### 6. Cryptographic Room Code Generation
- Room codes are generated server-side using cryptographically secure random bytes (`crypto.randomBytes`) over unambiguous alphanumeric character sets.

### 7. Input Validation & Sanitization
- Gamertags and chat messages are sanitized, trimmed, and length-restricted.
- Game moves (such as Tic-Tac-Toe positions or numbers) enforce strict integer range validation to prevent float or payload bypasses.

---

## Security Guidelines for Developers

When contributing code to BattleBox, ensure:
- All new socket event handlers validate incoming payload types and bounds.
- No client-controlled data is trusted for identity (always use server-derived socket session state).
- Answers, target solutions, or hidden state are kept private in server memory until game completion.
