<?php
declare(strict_types=1);

final class Database
{
    public static function connect(array $config): PDO
    {
        $db = $config['database'];
        return new PDO("mysql:host={$db['host']};port={$db['port']};dbname={$db['name']};charset=utf8mb4", $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
}
