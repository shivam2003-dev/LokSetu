# Scoped dashboard users

LokSetu dashboard accounts can be assigned to a state, district, and Lok Sabha constituency. The API signs that assignment into the user's session and applies it again on every protected dashboard request. Client query parameters cannot widen the configured geography.

## Create an account

1. Sign in with a user that has the `users:manage` permission.
2. Open **Settings**.
3. In **Create a geographically scoped dashboard user**, enter the name, username, temporary password, role, state, district, and constituency.
4. Select permissions and create the account.

MP users should normally receive:

- `dashboard:view`
- `issues:view`
- `projects:update` when they are allowed to change project decisions

The temporary password must contain at least eight characters. Passwords are stored as PBKDF2-SHA256 hashes; plaintext passwords are never returned by the API.

## Enforcement

The following surfaces use the authenticated assignment rather than trusting browser filters:

- dashboard priorities and homepage totals
- state/district/constituency context options
- map boundaries and hotspot clusters
- daily intelligence, analytics, Copilot answers, and the enterprise situation room
- public project queries made inside an authenticated dashboard session
- MP queues and project status mutations

Restricted users see a locked-scope banner on the homepage and cannot select **All India** or another state. User-management and demo-data controls are hidden unless the account has `users:manage`.

Postgres installations add `permissions`, `state`, `district`, and `constituency_id` columns to `app_users` automatically during API startup. Existing admin accounts retain role-based default permissions.
