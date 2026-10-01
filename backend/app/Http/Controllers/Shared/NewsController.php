<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;

use App\Models\News;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class NewsController extends Controller
{
    public function store(Request $request) { $this->authorizeRole($request); return response()->json(['news' => $this->save($request, new News)], 201); }
    public function update(Request $request, News $news) { $this->authorizeNews($request, $news); return response()->json(['news' => $this->save($request, $news)]); }
    public function destroy(Request $request, News $news) { $this->authorizeNews($request, $news); $news->delete(); return response()->noContent(); }

    private function save(Request $request, News $news): News
    {
        // Ordinary village news and older clients always belong to the news
        // section. TAO homepage management sends its section explicitly.
        $request->merge([
            'display_section' => $request->input('display_section', 'news'),
        ]);

        $data = $request->validate([
            'display_section' => ['required', Rule::in(['hero', 'news', 'video'])],
            'title' => [Rule::requiredIf($request->input('display_section') !== 'hero'), 'nullable', 'string', 'max:255'],
            'content' => [Rule::requiredIf($request->input('display_section') === 'news'), 'nullable', 'string'],
            'image' => [Rule::requiredIf(! $news->exists && in_array($request->input('display_section'), ['hero', 'news'], true)), 'nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'video_url' => [Rule::requiredIf($request->input('display_section') === 'video'), 'nullable', 'url', 'max:1000'],
            'published_at' => ['nullable', 'date'],
        ]);
        $data['title'] = $data['title'] ?: 'ภาพกิจกรรมสำคัญ อบต.มะต้อง';
        $data['content'] = $data['content'] ?? '';
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('news', 'public');
            $data['image'] = $request->getSchemeAndHttpHost().Storage::url($path);
        } else {
            unset($data['image']);
        }
        $news->fill($data + ['created_by' => $request->user()->id, 'village_id' => $request->user()->isVillageAdmin() ? $request->user()->village_id : null, 'published_at' => $data['published_at'] ?? now()])->save();
        return $news;
    }

    private function authorizeRole(Request $request): void
    {
        abort_unless($request->user()->isTao() || $request->user()->isVillageAdmin(), 403);
    }

    private function authorizeNews(Request $request, News $news): void
    {
        $this->authorizeRole($request);
        abort_unless($request->user()->isTao() || $news->village_id === $request->user()->village_id, 403);
    }
}
