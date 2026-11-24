# MAHI BROWSER Local REST API Reference

MAHI BROWSER includes an embedded HTTP REST API server allowing external applications, testing scripts, and automation bots to control profiles locally.

- **Default Endpoint**: `http://127.0.0.1:32123`
- **Authentication**: Bearer Token via HTTP Header: `Authorization: Bearer <your_api_token>`

> You can find or regenerate your API token in **Settings → Local REST API**.

---

## 1. Health Check

### `GET /health`
Verifies that the local REST API server is responsive (No authentication required).

#### Response (`200 OK`):
```json
{
  "status": "OK",
  "app": "Mahi Browser API",
  "version": "1.0.0"
}
```

---

## 2. Profiles API

### `GET /profiles`
List all saved browser profiles. Supports query parameters `search` and `status`.

#### Example Request:
```bash
curl -X GET http://127.0.0.1:32123/profiles \
  -H "Authorization: Bearer <your_api_token>"
```

---

### `POST /profiles`
Create a new browser profile.

#### Example Request:
```bash
curl -X POST http://127.0.0.1:32123/profiles \
  -H "Authorization: Bearer <your_api_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "QA Staging Profile",
    "folder": "QA",
    "tags": ["Automated", "Staging"],
    "settings": {
      "browser": {
        "engine": "chrome",
        "startupUrl": "https://example.com"
      }
    }
  }'
```

---

### `GET /profiles/:id`
Retrieve details of a specific profile by ID.

---

### `PUT /profiles/:id`
Update an existing profile.

---

### `DELETE /profiles/:id`
Delete a profile and its isolated storage directory.

---

### `POST /profiles/:id/start`
Launch the browser process for the profile.

#### Example Request:
```bash
curl -X POST http://127.0.0.1:32123/profiles/profile-123/start \
  -H "Authorization: Bearer <your_api_token>"
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "pid": 14592
}
```

---

### `POST /profiles/:id/stop`
Stop the running browser process for the profile.

---

### `POST /profiles/:id/clone`
Clone a profile into a new independent instance.

#### Example Request:
```bash
curl -X POST http://127.0.0.1:32123/profiles/profile-123/clone \
  -H "Authorization: Bearer <your_api_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "newName": "Cloned Profile Beta",
    "copyCookies": true,
    "copyExtensions": true
  }'
```

---

## 3. Proxies API

### `GET /proxies`
List all configured proxies.

### `POST /proxies`
Add a new proxy endpoint. Password is automatically encrypted before saving.

#### Example Request:
```bash
curl -X POST http://127.0.0.1:32123/proxies \
  -H "Authorization: Bearer <your_api_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "US East 01",
    "protocol": "http",
    "host": "198.51.100.1",
    "port": 8080,
    "username": "proxy_user",
    "password": "secret_password"
  }'
```

---

## 4. Automation API

### `POST /automation/run`
Execute an automated workflow on a specific profile.

#### Example Request:
```bash
curl -X POST http://127.0.0.1:32123/automation/run \
  -H "Authorization: Bearer <your_api_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "wf-123",
    "profileId": "profile-456"
  }'
```
