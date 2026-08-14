# Security policy

This project is a local-only single-user tool. It binds to `127.0.0.1` and intentionally has no authentication, hosted deployment, or multi-user isolation.

Do not open the development server to a LAN or the public internet. Do not commit real Vault content, `.env.local`, tokens, cookies, webhook URLs, backups, logs, or release work directories.

Report a security issue privately to the repository owner through GitHub's private reporting channel when available. Do not include credentials or real Vault content in an issue.
