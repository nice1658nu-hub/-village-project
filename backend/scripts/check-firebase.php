<?php

require dirname(__DIR__).'/vendor/autoload.php';

$credentials = dirname(__DIR__).'/storage/app/firebase/service-account.json';
(new Kreait\Firebase\Factory)
    ->withServiceAccount($credentials)
    ->createMessaging();

echo "FIREBASE_ADMIN_OK\n";
