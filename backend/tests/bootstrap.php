<?php

// The development server caches its MySQL configuration for faster startup.
// PHPUnit must remove that cache before Laravel boots, otherwise RefreshDatabase
// can accidentally run against the real development database instead of the
// in-memory SQLite database configured in phpunit.xml.
foreach (array_merge(
    [__DIR__.'/../bootstrap/cache/config.php', __DIR__.'/../bootstrap/cache/events.php'],
    glob(__DIR__.'/../bootstrap/cache/routes-*.php') ?: [],
) as $cacheFile) {
    if (is_file($cacheFile)) {
        unlink($cacheFile);
    }
}

return require __DIR__.'/../vendor/autoload.php';
