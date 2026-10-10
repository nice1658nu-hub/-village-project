<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_filter(explode(',', env('FRONTEND_URLS', 'http://127.0.0.1:5173,http://localhost:5173'))),
    // Allow preview deployments that belong to this Vercel project. The
    // production domain remains listed explicitly in FRONTEND_URLS.
    'allowed_origins_patterns' => array_filter(explode(',', env(
        'FRONTEND_ORIGIN_PATTERNS',
        '#^https://smartvillagematong(?:-[a-z0-9-]+)*\.vercel\.app$#'
    ))),
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
