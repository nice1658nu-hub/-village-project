<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('mail:test {email}', function (string $email) {
    if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $this->error('Invalid email address.');
        return self::FAILURE;
    }

    Mail::raw(
        'SmartVillage email is configured correctly. You can now use password recovery.',
        fn ($message) => $message->to($email)->subject('SmartVillage email test')
    );
    $this->info("Test email sent to {$email}.");
    return self::SUCCESS;
})->purpose('Send a SmartVillage SMTP test email');
