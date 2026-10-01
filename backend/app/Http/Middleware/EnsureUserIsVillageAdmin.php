<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsVillageAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->isVillageAdmin(), 403, 'Village administrator access required.');
        return $next($request);
    }
}
