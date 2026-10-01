<?php

namespace App\Http\Controllers\Cases;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\IncidentFeedback;
use Illuminate\Http\Request;

class IncidentFeedbackController extends Controller
{
    public function store(Request $request, Incident $incident)
    {
        abort_unless($incident->user_id === $request->user()->id, 403);
        abort_unless($incident->status === 'resolved', 409, 'Feedback is available after the incident is resolved.');

        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $feedback = IncidentFeedback::updateOrCreate(
            ['incident_id' => $incident->id, 'user_id' => $request->user()->id],
            $data,
        );

        return response()->json(['feedback' => $feedback]);
    }
}
