<?php
declare(strict_types=1);

final class Mailer
{
    public static function verification(array $config, string $email, string $url): void
    {
        $subject='Verify your Konoha Notes account';
        $message="Open this link to verify your email:\n{$url}";
        $headers='From: '.$config['mail']['from_name'].' <'.$config['mail']['from_address'].'>';
        if ($config['env'] === 'production') { @mail($email,$subject,$message,$headers); return; }
        file_put_contents(dirname(__DIR__,2).'/storage/logs/verification-links.log',date(DATE_ATOM)." {$email} {$url}\n",FILE_APPEND|LOCK_EX);
    }
}
