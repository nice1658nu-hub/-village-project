<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IncidentStatusHistory extends Model
{
    protected $fillable = ['incident_id', 'changed_by', 'from_status', 'to_status', 'note'];
}
