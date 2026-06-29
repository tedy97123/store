<?php

namespace App\Enum;

enum OrderStatus: string
{
    case PENDING = 'pending';
    case PAID = 'paid';
    case SHIPPED = 'shipped';
    case COMPLETED = 'completed';
    case CANCELLED = 'cancelled';
    case REFUNDED = 'refunded';
}
