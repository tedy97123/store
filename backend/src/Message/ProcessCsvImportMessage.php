<?php

namespace App\Message;

final readonly class ProcessCsvImportMessage
{
    public function __construct(public int $jobId)
    {
    }
}
