<?php
declare(strict_types=1);

final class NoteRepository
{
    public function __construct(private PDO $db) {}
    public function all(int $userId, string $query = ''): array
    { $sql='SELECT * FROM notes WHERE user_id=?'; $args=[$userId]; if($query!==''){ $sql.=' AND (title LIKE ? OR content LIKE ?)'; $needle='%'.$query.'%'; $args[]=$needle;$args[]=$needle; } $sql.=' ORDER BY pinned DESC, updated_at DESC'; $s=$this->db->prepare($sql);$s->execute($args);return array_map($this->map(...),$s->fetchAll()); }
    public function find(int $userId, int $id): ?array { $s=$this->db->prepare('SELECT * FROM notes WHERE id=? AND user_id=?');$s->execute([$id,$userId]);$row=$s->fetch();return $row?$this->map($row):null; }
    public function create(int $userId, array $data): array { $s=$this->db->prepare('INSERT INTO notes (user_id,title,content,tags,pinned,color) VALUES (?,?,?,?,?,?)');$s->execute([$userId,$data['title'],$data['content'],json_encode($data['tags'],JSON_UNESCAPED_UNICODE),$data['pinned'],$data['color']]);return $this->find($userId,(int)$this->db->lastInsertId()); }
    public function update(int $userId,int $id,array $data): ?array { $s=$this->db->prepare('UPDATE notes SET title=?,content=?,tags=?,pinned=?,color=? WHERE id=? AND user_id=?');$s->execute([$data['title'],$data['content'],json_encode($data['tags'],JSON_UNESCAPED_UNICODE),$data['pinned'],$data['color'],$id,$userId]);return $this->find($userId,$id); }
    public function delete(int $userId,int $id): bool { $s=$this->db->prepare('DELETE FROM notes WHERE id=? AND user_id=?');$s->execute([$id,$userId]);return $s->rowCount()===1; }
    private function map(array $r): array { return ['id'=>(string)$r['id'],'title'=>$r['title'],'content'=>$r['content'],'tags'=>json_decode($r['tags'],true)?:[],'pinned'=>(bool)$r['pinned'],'color'=>$r['color'],'createdAt'=>strtotime($r['created_at'])*1000,'updatedAt'=>strtotime($r['updated_at'])*1000]; }
}
