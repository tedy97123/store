<?php

namespace App\Security;

use App\Entity\Store;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Vote;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/** @extends Voter<string, Store|null> */
class StoreVoter extends Voter
{
    public const MANAGE = 'STORE_MANAGE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return self::MANAGE === $attribute && ($subject instanceof Store || null === $subject);
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token, ?Vote $vote = null): bool
    {
        $user = $token->getUser();
        if (!$user instanceof User) {
            return false;
        }

        if (in_array('ROLE_SUPER_ADMIN', $user->getRoles(), true)) {
            return true;
        }

        if (!$subject instanceof Store) {
            return false;
        }

        return $subject->getOwner()?->getId() === $user->getId();
    }
}
