<?php
declare(strict_types=1);

final class Session
{
    public static function start(array $config): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        session_name($config['session_name']);
        session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => str_starts_with($config['url'], 'https://'), 'httponly' => true, 'samesite' => 'Lax']);
        session_start();

        $lastSeen = isset($_SESSION['last_seen']) ? (int) $_SESSION['last_seen'] : null;
        if ($lastSeen !== null && time() - $lastSeen > (int) $config['session_lifetime']) {
            $_SESSION = [];
            session_regenerate_id(true);
        }

        $_SESSION['last_seen'] = time();
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    }

    public static function userId(): ?int { return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null; }
    public static function login(int $userId): void { session_regenerate_id(true); $_SESSION['user_id'] = $userId; $_SESSION['last_seen'] = time(); }
    public static function logout(): void { $_SESSION = []; session_destroy(); }
    public static function requireCsrf(): void { if (!hash_equals($_SESSION['csrf'] ?? '', $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) Http::json(['success' => false, 'message' => 'Invalid CSRF token.'], 419); }
}
