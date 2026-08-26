<?php
declare(strict_types=1);

/**
 * Carregador mínimo de arquivos .env (formato CHAVE=valor, sem dependências).
 * As credenciais nunca ficam no código-fonte nem no repositório — apenas
 * neste arquivo, que deve ser mantido fora do controle de versão.
 */
final class Env
{
    /** @var array<string, string>|null */
    private static ?array $values = null;

    public static function get(string $key, ?string $default = null): ?string
    {
        if (self::$values === null) {
            self::$values = self::load();
        }

        return self::$values[$key] ?? $default;
    }

    /** @return array<string, string> */
    private static function load(): array
    {
        $path = __DIR__ . '/../.env';
        if (!is_readable($path)) {
            return [];
        }

        $values = [];
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            $parts = explode('=', $trimmed, 2);
            if (count($parts) !== 2) {
                continue;
            }

            [$key, $value] = $parts;
            $key = trim($key);
            $value = trim($value);
            $value = trim($value, "\"'");

            $values[$key] = $value;
        }

        return $values;
    }
}
