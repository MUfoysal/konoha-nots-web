<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/Core/Http.php';
require dirname(__DIR__) . '/app/Core/Session.php';
require dirname(__DIR__) . '/app/Core/Database.php';
require dirname(__DIR__) . '/app/Repositories/UserRepository.php';
require dirname(__DIR__) . '/app/Repositories/NoteRepository.php';
require dirname(__DIR__) . '/app/Services/HtmlSanitizer.php';
require dirname(__DIR__) . '/app/Services/Mailer.php';
require dirname(__DIR__) . '/app/Controllers/AuthController.php';
require dirname(__DIR__) . '/app/Controllers/NoteController.php';

$config = require dirname(__DIR__) . '/config/app.php';
Session::start($config);
try {
    $db = Database::connect($config); $users = new UserRepository($db); $auth = new AuthController($db,$config,$users); $notes = new NoteController($users,new NoteRepository($db));
    $route = trim((string)($_GET['route'] ?? ''), '/'); $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if($method==='GET'&&$route==='csrf')$auth->csrf(); if($method==='GET'&&$route==='auth/me')$auth->me();
    if($method==='GET'&&$route==='auth/google/status')$auth->googleStatus();
    if($method==='POST'&&$route==='auth/register')$auth->register(); if($method==='POST'&&$route==='auth/login')$auth->login(); if($method==='POST'&&$route==='auth/logout')$auth->logout(); if($method==='GET'&&$route==='auth/verify')$auth->verify();
    if($method==='GET'&&$route==='auth/google/start')$auth->googleStart(); if($method==='GET'&&$route==='auth/google/callback')$auth->googleCallback();
    if($route==='notes'&&$method==='GET')$notes->list(); if($route==='notes'&&$method==='POST')$notes->create();
    if(preg_match('#^notes/(\d+)$#',$route,$match)){if($method==='PUT')$notes->update((int)$match[1]);if($method==='DELETE')$notes->delete((int)$match[1]);}
    Http::json(['success'=>false,'message'=>'Route not found.'],404);
} catch (PDOException $e) { error_log($e->getMessage()); Http::json(['success'=>false,'message'=>'Service is temporarily unavailable.'],503); }
catch (Throwable $e) { error_log($e->getMessage()); Http::json(['success'=>false,'message'=>'Unexpected server error.'],500); }
