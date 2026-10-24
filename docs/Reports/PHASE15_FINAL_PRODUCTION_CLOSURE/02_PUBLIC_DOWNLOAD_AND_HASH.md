# MAHI BROWSER v1.1.3 — PUBLIC DOWNLOAD & HASH VERIFICATION
## Document: 02_PUBLIC_DOWNLOAD_AND_HASH.md
**Project Path:** `C:\Users\munaf\Desktop\mahai brouser`  
**Public Download URL:** `https://mahibrowser.com/download/setup`  
**Portable Download URL:** `https://mahibrowser.com/download/portable`  
**Test Date:** October 14, 2026

---

### 1. THREE-WAY INDEPENDENT HASH AUDIT

To eliminate historical reporting errors, the installer was measured across three distinct environments:
1. Locally built release candidate
2. Production VPS on-disk storage
3. Full end-to-end download over the public internet

```
========================================================================================
SOURCE               TARGET ARTIFACT                BYTE SIZE       SHA-256 CHECKSUM
========================================================================================
1. Local Workspace   MAHI-Browser-Setup-1.1.3.exe   295,622,638     6A0048AE40B93EF6C40171999FD006706332906E0B4A5FF5CF2689E107C21E61
2. VPS Disk Storage  MAHI-Browser-Setup-1.1.3.exe   295,622,638     6A0048AE40B93EF6C40171999FD006706332906E0B4A5FF5CF2689E107C21E61
3. Public Internet   MAHI-Browser-Setup-1.1.3.exe   295,622,638     6A0048AE40B93EF6C40171999FD006706332906E0B4A5FF5CF2689E107C21E61
========================================================================================
RESULT: EXACT TRIPLE MATCH (BIT-FOR-BIT IDENTICAL)
========================================================================================
```

---

### 2. PORTABLE ARTIFACT VERIFICATION

```
========================================================================================
SOURCE               TARGET ARTIFACT                BYTE SIZE       SHA-256 CHECKSUM
========================================================================================
1. Local Workspace   MAHI-Browser-Portable-1.1.3.exe 295,162,376    F0F6770F907826EB06734DCCDEC5F8DF7C9CCD47F232998DA19BE2030BA96A7F
2. VPS Disk Storage  MAHI-Browser-Portable-1.1.3.exe 295,162,376    F0F6770F907826EB06734DCCDEC5F8DF7C9CCD47F232998DA19BE2030BA96A7F
========================================================================================
RESULT: EXACT DUAL MATCH
========================================================================================
```

---

### 3. LIVE HTTP PROTOCOL & PE BINARY VALIDATION

#### A. Direct Download HTTP Headers
```http
GET /download/setup HTTP/1.1
Host: mahibrowser.com
User-Agent: curl/8.x (Clean Anonymous Request)

HTTP/1.1 200 OK
Server: nginx
Content-Type: application/octet-stream
Content-Length: 295622638
Last-Modified: Tue, 13 Oct 2026 21:39:21 GMT
Connection: keep-alive
Content-Disposition: attachment; filename="MAHI-Browser-Setup-1.1.3.exe"
Cache-Control: private, no-cache, no-store, must-revalidate
Accept-Ranges: bytes
```

#### B. Header Analysis & Integrity
- **Zero Redirection:** Eliminates mandatory signup/login loops (`302 Found` removed).
- **Correct File Naming:** `Content-Disposition` explicitly provides `MAHI-Browser-Setup-1.1.3.exe`.
- **Exact Payload:** `Content-Length: 295622638` matches on-disk byte length.
- **Range Support:** `Accept-Ranges: bytes` allows multi-threaded download accelerators and resumable transfers.

#### C. Portable Executable (PE) Magic Bytes
Range inspection (`bytes=0-1023`) verified the initial bytes:
- Hex: `4D 5A` (ASCII: `MZ`)
- DOS Stub Signature: `This program cannot be run in DOS mode.`
- Confirms the returned payload is an authentic Windows x64 executable, not an HTML error or redirect page.
