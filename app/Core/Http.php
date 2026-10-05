<?php
declare(strict_types=1);

final class Http
{
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function body(): array
    {
        $data = json_decode(file_get_contents('php://input') ?: '', true);
        if (!is_array($data)) self::json(['success' => false, 'message' => 'Invalid JSON request body.'], 400);
        return $data;
    }
}
