# Security Notes

## Known historical exposure

The production VPS IPv4 address was committed in plain text in 27 markdown files of this
public repository before 2026-11-16. It has since been replaced with the token
<VPS_HOST>. Git history still contains the address; history was deliberately not rewritten
and no force-push was performed, because rewriting published history is more disruptive
than the exposure itself.

The IP address is not a secret. The SSH private key is. If that key was ever stored in a
tracked file, in CI logs, or in any commit, it must be rotated. Key rotation is OWNER TO DO.

## CI / deploy secrets

These are the only secret names the release pipeline may reference. Values are never
printed and never committed.

| Name | Purpose | Status |
|---|---|---|
| VPS_HOST | deployment target host | SET |
| VPS_USER | ssh user | SET |
| VPS_PORT | ssh port | SET |
| VPS_SSH_KEY | ssh private key | SET |
