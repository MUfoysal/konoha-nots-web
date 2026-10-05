<?php
declare(strict_types=1);

final class NoteController
{
    public function __construct(private UserRepository $users,private NoteRepository $notes) {}
    public function list(): never { $u=$this->user();Http::json(['success'=>true,'data'=>['notes'=>$this->notes->all((int)$u['id'],mb_substr(trim((string)($_GET['q']??'')),0,100))]]); }
    public function create(): never { Session::requireCsrf();$u=$this->user();Http::json(['success'=>true,'data'=>['note'=>$this->notes->create((int)$u['id'],$this->payload(Http::body()))]],201); }
    public function update(int $id): never { Session::requireCsrf();$u=$this->user();$n=$this->notes->update((int)$u['id'],$id,$this->payload(Http::body()));if(!$n)Http::json(['success'=>false,'message'=>'Note not found.'],404);Http::json(['success'=>true,'data'=>['note'=>$n]]); }
    public function delete(int $id): never { Session::requireCsrf();$u=$this->user();if(!$this->notes->delete((int)$u['id'],$id))Http::json(['success'=>false,'message'=>'Note not found.'],404);Http::json(['success'=>true,'message'=>'Note deleted.']); }
    private function user(): array { $id=Session::userId();$u=$id?$this->users->byId($id):null;if(!$u)Http::json(['success'=>false,'message'=>'Authentication required.'],401);return $u; }
    private function payload(array $d): array { $tags=array_values(array_filter(array_slice(array_map(fn($v)=>mb_substr(trim((string)$v),0,40),(array)($d['tags']??[])),0,20)));return ['title'=>mb_substr(trim((string)($d['title']??'Untitled')),0,255)?:'Untitled','content'=>HtmlSanitizer::note((string)($d['content']??'')),'tags'=>$tags,'pinned'=>!empty($d['pinned'])?1:0,'color'=>'default']; }
}
