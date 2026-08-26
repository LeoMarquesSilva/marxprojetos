<?php
declare(strict_types=1);

/**
 * Rate limiting simples baseado em arquivo — adequado para hospedagem
 * compartilhada, sem dependência de banco de dados ou cache externo.
 */
final class RateLimiter
{
    public function __construct(
        private readonly string $storageDir,
        private readonly int $maxRequests = 5,
        private readonly int $windowSeconds = 600,
    ) {
    }

    public function tooManyRequests(string $identifier): bool
    {
        if (!is_dir($this->storageDir)) {
            @mkdir($this->storageDir, 0755, true);
        }

        $file = $this->storageDir . '/' . hash('sha256', $identifier) . '.json';
        $now = time();
        $timestamps = [];

        $handle = @fopen($file, 'c+');
        if ($handle === false) {
            // Se não for possível persistir, não bloqueia o envio.
            return false;
        }

        flock($handle, LOCK_EX);
        $contents = stream_get_contents($handle);
        if ($contents) {
            $decoded = json_decode($contents, true);
            if (is_array($decoded)) {
                $timestamps = $decoded;
            }
        }

        $timestamps = array_values(array_filter(
            $timestamps,
            fn ($timestamp) => is_int($timestamp) && ($now - $timestamp) < $this->windowSeconds,
        ));

        $limited = count($timestamps) >= $this->maxRequests;

        if (!$limited) {
            $timestamps[] = $now;
            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode($timestamps));
        }

        flock($handle, LOCK_UN);
        fclose($handle);

        return $limited;
    }
}
