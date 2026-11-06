<?php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumToken;

/**
 * Sanctum writes "last used" to the database on every authenticated request. On a remote database that is a full
 * round trip for a value nobody needs to the second, so it is only written when it is more than five minutes old.
 */
class PersonalAccessToken extends SanctumToken
{
    public function save(array $options = [])
    {
        if ($this->exists && ! $this->wasRecentlyCreated && array_keys($this->getDirty()) === ['last_used_at']
            && $this->getOriginal('last_used_at') && $this->getOriginal('last_used_at')->gt(now()->subMinutes(5))) {
            return true;
        }
        return parent::save($options);
    }
}
