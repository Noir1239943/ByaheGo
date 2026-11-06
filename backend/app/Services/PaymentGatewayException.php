<?php

namespace App\Services;

class PaymentGatewayException extends \RuntimeException
{
    public function __construct(string $message, public readonly string $errorCode = '', public readonly int $httpStatus = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }
}
