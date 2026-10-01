<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'phone',
        'email',
        'house_no',
        'village_id',
        'role',
        'account_status',
        'approved_by',
        'approved_at',
        'approval_note',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function incidents()
    {
        return $this->hasMany(Incident::class);
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, ['admin', 'tao'], true);
    }

    public function isStaff(): bool
    {
        return $this->role === 'staff';
    }

    public function isVillageCoordinator(): bool
    {
        return in_array($this->role, ['staff', 'village_admin'], true);
    }

    public function isTao(): bool
    {
        return in_array($this->role, ['tao', 'admin'], true);
    }

    public function isVillageAdmin(): bool
    {
        return in_array($this->role, ['village_admin', 'staff'], true);
    }

    public function village()
    {
        return $this->belongsTo(Village::class);
    }

    public function assignedIncidents()
    {
        return $this->hasMany(Incident::class, 'assigned_to');
    }
}
