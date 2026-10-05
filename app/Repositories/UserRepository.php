<?php
declare(strict_types=1);

final class UserRepository
{
    public function __construct(private PDO $db) {}
    public function byId(int $id): ?array { $s=$this->db->prepare('SELECT * FROM users WHERE id=?'); $s->execute([$id]); return $s->fetch() ?: null; }
    public function byEmail(string $email): ?array { $s=$this->db->prepare('SELECT * FROM users WHERE email=?'); $s->execute([$email]); return $s->fetch() ?: null; }
    public function byLogin(string $login): ?array { $s=$this->db->prepare('SELECT * FROM users WHERE username=? OR email=? LIMIT 1'); $s->execute([$login,$login]); return $s->fetch() ?: null; }
    public function create(string $name, string $username, string $email, string $clan, ?string $passwordHash, ?string $googleId = null, ?string $avatar = null, bool $verified = false): int
    { $s=$this->db->prepare('INSERT INTO users (name,username,email,clan,password_hash,google_id,avatar,email_verified_at) VALUES (?,?,?,?,?,?,?,?)'); $s->execute([$name,$username,$email,$clan,$passwordHash,$googleId,$avatar,$verified?date('Y-m-d H:i:s'):null]); return (int)$this->db->lastInsertId(); }
    public function markVerified(int $id): void { $s=$this->db->prepare('UPDATE users SET email_verified_at=NOW() WHERE id=?'); $s->execute([$id]); }
    public function public(array $u): array { return ['id'=>(int)$u['id'],'name'=>$u['name'],'username'=>$u['username'],'email'=>$u['email'],'clan'=>$u['clan'],'avatar'=>$u['avatar'],'createdAt'=>strtotime($u['created_at'])*1000]; }
}
