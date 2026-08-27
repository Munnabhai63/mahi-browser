<?php

// YOUR SECRET PRIVATE KEY
$PRIVATE_KEY = <<<EOD
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8h86FUbaG3xeb
zfvQwwECpT080q7ctF9YzH8Lnm+BXD7ySmavwZv9x4YT2ZmcnCzqrwLvo2ChUwYI
dWe/TYz2pLAWI6BoVc1Xu6r/O/9DpflQeY4tJnDe1nkqFT81ivajcPGxXmALN5LS
3+yGf6CcS04EU1k039Dbc2TC/xn5XW3eyiU8hkcORvjkIjoKpt6vLVuE8BUnczPv
gG4hVbkerNB+IJ9Loi4ng+ImvDke9FgKFxYhyvIt8GJV5yxXGWXPSnWD0j7MnEw0
UjafrTcqUIqsYlzYVf/oLKJlGwxPFWRZvtv3wOuGW2YK2JmnnlrW57tNX1L+E63G
ZjAl+LdPAgMBAAECggEARST51WOWsfh4TChLxtD+Od4oi3opr8Bnh8XYgoZlFuii
HXK0Hpm/gGABCJ6x/AI7Zwcw6HrfIcu1VrzYhA0JOhxEiJogZqOxYA/wMxPqFwF0
YtNyFZUXqGK4pXqNaDHDK0ZtHkQirXqAWt7NfLaqTShBQMzg1sePbizwM6Qj/pRo
Y4D/p8BzAICcM1yafxm1bis0QdM/c9Qqvv18dVf8Z8uSAJS5fj3pDdxJ1uFWEbK1
YayFnU8p+zoJGhBE6Z+12mrkbdjM7z5qR+0F7hWIQgV0t4fVf+GRh1ifgOg4aTPF
aF9pNY1NVdVcvkZ8LouDlnLBL9PU5M7xWMyPZZX3oQKBgQDd9BXGdx2Nm0JwjRkU
Go9ejRF1hrGqA9WgHl6ZajcqwqSa66sklgfu4LSLhHA3EP9hLruBVDm7pUlgzrtu
ahh3XoIelv0aOHY6Ucd8etiwz4/Ay0JZC8e9z6zekdBe3RR+R5dvCZu9vleySo9w
oUw8P6EdECTA+4LiOfJjNFihNQKBgQDZcztNVq7ycQ/maD0akOpAMBNv7g9fF6Xx
VsZIkI8i9dQLWeVf7Fp6dEudJoCG8Vy2OXJshh02l/JS+8KRC4AmGYYwkyQDedO+
vfQbSaUKV7XElg2ZdzCPSDveTte4onvHpqiUimKqndoCW2kg9jhdXdKHjAh2OeiI
qkEEF3Eq8wKBgQDSbNe8Ki/9keYCePL+yVOFa67Swplru2jr/f7n6fhVdOXD7ox6
CjeJNMZWw3/z5QyJYVnpeiWmDkUsH7M5MiLyAMrSH4nkMwV7sw6yqHEJ6C68tLe5
Xl7HSL324T0wwt7r/gnG/tAFqxDPerrVKEbzk8u2lxiRUaI7wn5XqUghxQKBgCov
Sq/kQyhRes4uJryCpI8zRHIQcvb1tYGuXeUx9jLIEgzpsa/8QElFSm4ATCrhpCTN
3D7lfcFblO04XjSZUJETno7J3NC3z7ZPT44DqXrqLR8oJRdCoi8JymOEVCFDlFPV
Jxs6BY4n9WVDqo90dNbYHsGhDvswnMX2kYpjqda1AoGAXe8JPMFU03NnFNh5k51C
FUz+2ZOwte1RKiTgiYwOAAWS2hRPwFauYizRSI8T3dsVZeiSiUYsZ5uN0f4pZJch
EA3iHwdGqlxo0M5xdBGwIoGtWzxO15g9M9KSQXQlvOj3m/GXzxdPJtjH1aHyJEYb
ujHu8L4pZ5jnE76ms2HahVk=
-----END PRIVATE KEY-----
EOD;

function generateLicense($hwid, $monthsValid) {
    global $PRIVATE_KEY;

    // 1. Calculate Expiry in milliseconds
    $expiryTimestamp = (time() + ($monthsValid * 30 * 24 * 60 * 60)) * 1000;

    // 2. Create Signature Payload
    $payloadToSign = "{$hwid}:{$expiryTimestamp}";

    // 3. Sign it with RSA SHA-256
    openssl_sign($payloadToSign, $signature, $PRIVATE_KEY, OPENSSL_ALGO_SHA256);
    $signatureBase64 = base64_encode($signature);

    // 4. Package into JSON
    $licenseObj = [
        "hwid" => $hwid,
        "exp" => $expiryTimestamp,
        "sig" => $signatureBase64
    ];

    // 5. Encode as Base64 to give to User
    return base64_encode(json_encode($licenseObj));
}

// ---- HOW TO USE ----
// Replace with $_POST['hwid'] in your web panel
$studentHWID = "MAHI-2B77-99BC-3C46-A89A"; 
$durationMonths = 1;

$key = generateLicense($studentHWID, $durationMonths);

echo "======================================\n";
echo "SEND THIS KEY TO THE STUDENT:\n";
echo $key . "\n";
echo "======================================\n";

?>
