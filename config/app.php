<?php
declare(strict_types=1);

function env(string $key, ?string $default = null): ?string
{
    static $values = null;
    if ($values === null) {
        $values = [];
        $path = dirname(__DIR__) . '/.env';
        if (is_file($path)) {
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                if (str_starts_with(ltrim($line), '#') || !str_contains($line, '=')) continue;
                [$name, $value] = explode('=', $line, 2);
                $values[trim($name)] = trim($value, " \t\"'");
            }
        }
    }
    return $values[$key] ?? getenv($key) ?: $default;
}

return [
    'env' => env('APP_ENV', 'production'),
    'url' => rtrim((string) env('APP_URL', 'http://localhost'), '/'),
    'session_name' => env('APP_SESSION_NAME', 'konoha_notes_session'),
    'session_lifetime' => (int) env('APP_SESSION_LIFETIME', '7200'),
    'database' => [
        'host' => env('DB_HOST', '127.0.0.1'), 'port' => env('DB_PORT', '3306'),
        'name' => env('DB_NAME', 'konoha_notes'), 'user' => env('DB_USER', 'root'),
        'password' => env('DB_PASSWORD', ''),
    ],
    'mail' => ['from_address' => env('MAIL_FROM_ADDRESS', ''), 'from_name' => env('MAIL_FROM_NAME', 'Konoha Notes')],
    'google' => ['client_id' => env('GOOGLE_CLIENT_ID', ''), 'client_secret' => env('GOOGLE_CLIENT_SECRET', ''), 'redirect_uri' => env('GOOGLE_REDIRECT_URI', '')],
];
