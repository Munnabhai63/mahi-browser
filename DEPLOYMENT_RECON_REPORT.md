# PHASE 1 RECONNAISSANCE REPORT — PRODUCTION VPS

**Target Server Public IP:** `<VPS_HOST>`  
**Target Domain:** `mahibrowser.com` / `www.mahibrowser.com`  
**Status:** **PHASE 1 COMPLETE (STRICTLY READ-ONLY). DEPLOYMENT PAUSED PENDING DNS UPDATE.**

---

## 1. System Specifications & Resources

### OS Version (`uname -a && cat /etc/os-release`):
```text
Linux srv1814872 6.8.0-138-generic #138-Ubuntu SMP PREEMPT_DYNAMIC Fri Jul 31 22:41:49 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux
PRETTY_NAME="Ubuntu 24.04.5 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
VERSION="24.04.5 LTS (Noble Numbat)"
VERSION_CODENAME=noble
ID=ubuntu
```

### Disk Space (`df -h`):
```text
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        96G   30G   67G  31% /
/dev/sda16      881M  116M  704M  15% /boot
/dev/sda15      105M  6.2M   99M   6% /boot/efi
```
*Health:* **67 GB Available** on root partition (ample space for 90.9 MB installer and static site).

### Memory Usage (`free -h`):
```text
               total        used        free      shared  buff/cache   available
Mem:           7.8Gi       3.7Gi       631Mi       172Mi       4.1Gi       4.1Gi
Swap:          4.0Gi       332Mi       3.7Gi
```
*Health:* **4.1 GB Available RAM**.

---

## 2. Server Public IPv4 Address

Command: `curl -4 -s ifconfig.me`
```text
<VPS_HOST>
```

---

## 3. Listening Ports & Owning Processes (`ss -tulpn`)

```text
Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process                                                                                     
udp   UNCONN 0      0         127.0.0.54:53         0.0.0.0:*     users:(("systemd-resolve",pid=3591830,fd=16))                                              
udp   UNCONN 0      0      127.0.0.53%lo:53         0.0.0.0:*     users:(("systemd-resolve",pid=3591830,fd=14))                                              
udp   UNCONN 0      0          127.0.0.1:1721       0.0.0.0:*     users:(("monarx-agent",pid=1358700,fd=9))                                                  
tcp   LISTEN 0      511          0.0.0.0:443        0.0.0.0:*     users:(("nginx",pid=3591842,fd=7),("nginx",pid=1733723,fd=7),("nginx",pid=1733722,fd=7))   
tcp   LISTEN 0      511          0.0.0.0:80         0.0.0.0:*     users:(("nginx",pid=3591842,fd=5),("nginx",pid=1733723,fd=5),("nginx",pid=1733722,fd=5))   
tcp   LISTEN 0      4096       127.0.0.1:6379       0.0.0.0:*     users:(("docker-proxy",pid=2102664,fd=8))                                                  
tcp   LISTEN 0      511          0.0.0.0:5050       0.0.0.0:*     users:(("node /var/www/f",pid=3349248,fd=26))                                              
tcp   LISTEN 0      4096       127.0.0.1:4080       0.0.0.0:*     users:(("docker-proxy",pid=3537250,fd=8))                                                  
tcp   LISTEN 0      4096       127.0.0.1:65529      0.0.0.0:*     users:(("monarx-agent",pid=1358700,fd=18))                                                 
tcp   LISTEN 0      4096         0.0.0.0:54322      0.0.0.0:*     users:(("docker-proxy",pid=1397960,fd=8))                                                  
tcp   LISTEN 0      511        127.0.0.1:5051       0.0.0.0:*     users:(("node",pid=2697377,fd=24))                                                         
tcp   LISTEN 0      4096       127.0.0.1:9000       0.0.0.0:*     users:(("docker-proxy",pid=585890,fd=8))                                                   
tcp   LISTEN 0      4096         0.0.0.0:2222       0.0.0.0:*     users:(("sshd",pid=3591836,fd=3),("systemd",pid=1,fd=119))                                 
tcp   LISTEN 0      511          0.0.0.0:3002       0.0.0.0:*     users:(("nginx",pid=3591842,fd=15),("nginx",pid=1733723,fd=15),("nginx",pid=1733722,fd=15))
tcp   LISTEN 0      511          0.0.0.0:3001       0.0.0.0:*     users:(("node /root/traf",pid=3349214,fd=26))                                              
tcp   LISTEN 0      511          0.0.0.0:3000       0.0.0.0:*     users:(("nginx",pid=3591842,fd=11),("nginx",pid=1733723,fd=11),("nginx",pid=1733722,fd=11))
tcp   LISTEN 0      4096       127.0.0.1:4416       0.0.0.0:*     users:(("docker-proxy",pid=2769814,fd=8))                                                  
tcp   LISTEN 0      4096      127.0.0.54:53         0.0.0.0:*     users:(("systemd-resolve",pid=3591830,fd=17))                                              
tcp   LISTEN 0      511          0.0.0.0:8090       0.0.0.0:*     users:(("nginx",pid=3591842,fd=9),("nginx",pid=1733723,fd=9),("nginx",pid=1733722,fd=9))   
tcp   LISTEN 0      511          0.0.0.0:8080       0.0.0.0:*     users:(("nginx",pid=3591842,fd=13),("nginx",pid=1733723,fd=13),("nginx",pid=1733722,fd=13))
tcp   LISTEN 0      4096   127.0.0.53%lo:53         0.0.0.0:*     users:(("systemd-resolve",pid=3591830,fd=15))                                              
tcp   LISTEN 0      4096       127.0.0.1:5432       0.0.0.0:*     users:(("docker-proxy",pid=2102685,fd=8))                                                  
tcp   LISTEN 0      4096       127.0.0.1:5433       0.0.0.0:*     users:(("docker-proxy",pid=356496,fd=8))                                                   
tcp   LISTEN 0      511             [::]:443           [::]:*     users:(("nginx",pid=3591842,fd=8),("nginx",pid=1733723,fd=8),("nginx",pid=1733722,fd=8))   
tcp   LISTEN 0      511             [::]:80            [::]:*     users:(("nginx",pid=3591842,fd=6),("nginx",pid=1733723,fd=6),("nginx",pid=1733722,fd=6))   
tcp   LISTEN 0      4096            [::]:54322         [::]:*     users:(("docker-proxy",pid=1397965,fd=8))                                                  
tcp   LISTEN 0      4096            [::]:2222          [::]:*     users:(("sshd",pid=3591836,fd=4),("systemd",pid=1,fd=120))                                 
tcp   LISTEN 0      511                *:3036             *:*     users:(("node",pid=3349476,fd=24))                                                         
tcp   LISTEN 416    511                *:3025             *:*     users:(("next-server (v1",pid=2187856,fd=21))                                              
tcp   LISTEN 0      511                *:3030             *:*     users:(("next-server (v1",pid=3349376,fd=21))                                              
tcp   LISTEN 0      511                *:3010             *:*     users:(("PM2 v7.0.3: God",pid=1331533,fd=53))                                              
tcp   LISTEN 0      511             [::]:3002          [::]:*     users:(("nginx",pid=3591842,fd=16),("nginx",pid=1733723,fd=16),("nginx",pid=1733722,fd=16))
tcp   LISTEN 0      511             [::]:3000          [::]:*     users:(("nginx",pid=3591842,fd=12),("nginx",pid=1733723,fd=12),("nginx",pid=1733722,fd=12))
tcp   LISTEN 0      511                *:3005             *:*     users:(("next-server (v1",pid=3349402,fd=21))                                              
tcp   LISTEN 0      511             [::]:8090          [::]:*     users:(("nginx",pid=3591842,fd=10),("nginx",pid=1733723,fd=10),("nginx",pid=1733722,fd=10))
tcp   LISTEN 0      511             [::]:8080          [::]:*     users:(("nginx",pid=3591842,fd=14),("nginx",pid=1733723,fd=14),("nginx",pid=1733722,fd=14))
```

---

## 4. Web Server Owning Ports 80 & 443

**Owner:** **NGINX** (`nginx/1.24.0 (Ubuntu)`)  
Config Test: `nginx -t` -> **syntax is ok / test is successful**

---

## 5. Inventory of Existing Projects

### A. Nginx Enabled Virtual Hosts (`/etc/nginx/sites-enabled`):
1. `desisexy.in.conf` -> `/etc/nginx/sites-available/desisexy.in.conf`
2. `falcon-smm.conf`
3. `m4k-api.conf` -> `/etc/nginx/sites-available/m4k-api.conf`
4. `rumbletraffic.com` -> `/etc/nginx/sites-available/rumbletraffic.com`
5. `trafik-admin.conf` -> `/etc/nginx/sites-available/trafik-admin.conf`
6. `trafik-user.conf` -> `/etc/nginx/sites-available/trafik-user.conf`
7. `ytcpm.com` -> `/etc/nginx/sites-available/ytcpm.com`
8. `ytcpm.tech.conf` -> `/etc/nginx/sites-available/ytcpm.tech.conf`

### B. Docker Containers (`docker ps`):
- `m4k-cobalt-api` (`127.0.0.1:9000->9000/tcp`)
- `mahi_pot_provider` (`127.0.0.1:4416->4416/tcp`)
- `mahi_worker_prod`
- `mahi_api_prod` (`127.0.0.1:4080->4000/tcp`)
- `mahi_named_tunnel_prod`
- `mahi_postgres_prod` (`5432/tcp`)
- `mahi_redis_prod` (`6379/tcp`)
- `rumble_postgres` (`127.0.0.1:5433->5432/tcp`)
- `smm_postgres` (`127.0.0.1:5432->5432/tcp`)
- `smm_redis` (`127.0.0.1:6379->6379/tcp`)
- `supabase-db` (`0.0.0.0:54322->5432/tcp`)

### C. PM2 Process Manager (`pm2 list`):
- `clipbot-worker` (online)
- `desisexy-autopilot` (online)
- `desisexy-web` (online)
- `falcon-backend` (online)
- `rumble-traffic-bot` (online)
- `rumble-traffic-hermes` (online)
- `rumble-traffic-web` (online)
- `rumble-traffic-worker` (online)
- `smm-panel-web` (online)
- `smm-panel-worker` (online)
- `trafik-backend` (online)
- `ytcpm` (online)

---

## 6. Firewall State (`ufw status verbose`)

```text
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), deny (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
80/tcp                     ALLOW IN    Anywhere                   # HTTP Web Traffic
443/tcp                    ALLOW IN    Anywhere                   # HTTPS Web Traffic
2222/tcp                   ALLOW IN    Anywhere                   # SSH-NewPort
80/tcp (v6)                ALLOW IN    Anywhere (v6)              # HTTP Web Traffic
443/tcp (v6)               ALLOW IN    Anywhere (v6)              # HTTPS Web Traffic
2222/tcp (v6)              ALLOW IN    Anywhere (v6)              # SSH-NewPort
```
*Verdict:* **Ports 80 and 443 are already allowed.** **ZERO firewall modifications needed.**

---

## 7. ACME / SSL Client Check

Command: `/usr/bin/certbot --version`
```text
certbot 2.9.0
```
*Verdict:* **Certbot is already installed and functional** with existing certificates managed for other domains under `/etc/letsencrypt/live/`.

---

## 8. DNS Resolution Check

Command: `dig +short mahibrowser.com @8.8.8.8`
```text
2.57.91.91
```

Command: `dig +short www.mahibrowser.com @8.8.8.8`
```text
mahibrowser.com.
2.57.91.91
```

**CRITICAL FINDING:**
- The domain `mahibrowser.com` currently resolves to **`2.57.91.91`** (an external host / registrar default).
- The VPS Public IP address is **`<VPS_HOST>`**.
- They do **NOT** match.

Per strict safety rules:
> *"IF DNS does NOT point to this VPS: STOP, give me the exact A-records (@ and www → VPS IP) to add at my registrar, and wait for my confirmation. Do not proceed to Phase 2 without DNS."*

---

## Chosen Deployment Approach (Decision Tree)

Since **NGINX** is the active web server on ports 80/443:
1. **Zero modifications to existing files**: No existing `.conf` files in `/etc/nginx/` will be altered.
2. **New isolated configuration**: Create `/etc/nginx/sites-available/mahibrowser.com` and symlink to `/etc/nginx/sites-enabled/mahibrowser.com`.
3. **Directory Isolation**: Create `/var/www/mahi/download` with ownership `www-data:www-data`.
4. **Binary Upload**: SCP `release/MAHI BROWSER-1.0.0-Setup.exe` (90,936,073 bytes, MD5 `1CFC97F97E388E19506E1A1CF2D0DFD5`) to `/var/www/mahi/download/MAHI-Setup.exe`.
5. **SSL Certificate**: Issue automated TLS via `certbot --nginx -d mahibrowser.com -d www.mahibrowser.com`.
6. **Reload**: Execute `nginx -t` followed by `systemctl reload nginx` (zero dropped connections for existing sites).

---

## Required Action From User Before Proceeding to Phase 2

Please update your DNS records at your domain registrar (e.g. Namecheap, Cloudflare, GoDaddy):

| Type | Host / Name | Target / Value | TTL |
|---|---|---|---|
| **A** | `@` (or `mahibrowser.com`) | `<VPS_HOST>` | Auto / 300s (5m) |
| **A** | `www` (or `www.mahibrowser.com`) | `<VPS_HOST>` | Auto / 300s (5m) |

*(Alternatively, if `www` is a CNAME pointing to `@`, that works as well once `@` points to `<VPS_HOST>`).*

**Once updated and saved, reply to confirm. Phase 2 deployment will immediately proceed.**
