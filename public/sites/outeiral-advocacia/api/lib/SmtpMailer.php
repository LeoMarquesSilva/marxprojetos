<?php
declare(strict_types=1);

/**
 * Cliente SMTP mínimo, sem dependências externas (compatível com hospedagem
 * compartilhada sem Composer). Suporta AUTH LOGIN e STARTTLS (porta 587) ou
 * TLS implícito (porta 465). Suficiente para o volume de e-mails de um
 * formulário de contato institucional.
 */
final class SmtpMailer
{
    /** @var resource|null */
    private $socket = null;

    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly string $username,
        private readonly string $password,
        private readonly int $timeoutSeconds = 12,
    ) {
    }

    /**
     * @param string $fromEmail
     * @param string $fromName
     * @param string $toEmail
     * @param string $subject
     * @param string $body
     * @param string|null $replyTo
     * @throws RuntimeException
     */
    public function send(
        string $fromEmail,
        string $fromName,
        string $toEmail,
        string $subject,
        string $body,
        ?string $replyTo = null,
    ): void {
        $useImplicitTls = $this->port === 465;
        $transport = $useImplicitTls ? 'ssl://' : 'tcp://';

        $socket = @stream_socket_client(
            $transport . $this->host . ':' . $this->port,
            $errno,
            $errstr,
            $this->timeoutSeconds,
        );

        if ($socket === false) {
            throw new RuntimeException("Falha na conexão SMTP: {$errstr} ({$errno})");
        }

        $this->socket = $socket;
        stream_set_timeout($this->socket, $this->timeoutSeconds);

        $this->expect(220);
        $this->command('EHLO ' . $this->localHostname(), 250);

        if (!$useImplicitTls) {
            $this->command('STARTTLS', 220);
            if (!stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Falha ao iniciar TLS (STARTTLS).');
            }
            $this->command('EHLO ' . $this->localHostname(), 250);
        }

        $this->command('AUTH LOGIN', 334);
        $this->command(base64_encode($this->username), 334);
        $this->command(base64_encode($this->password), 235);

        $this->command('MAIL FROM:<' . $fromEmail . '>', 250);
        $this->command('RCPT TO:<' . $toEmail . '>', 250);
        $this->command('DATA', 354);

        $headers = $this->buildHeaders($fromEmail, $fromName, $toEmail, $subject, $replyTo);
        $payload = $headers . "\r\n" . $this->escapeBody($body) . "\r\n.";
        $this->rawWrite($payload);
        $this->expect(250);

        $this->command('QUIT', 221);
        fclose($this->socket);
        $this->socket = null;
    }

    private function buildHeaders(
        string $fromEmail,
        string $fromName,
        string $toEmail,
        string $subject,
        ?string $replyTo,
    ): string {
        $lines = [
            'From: ' . $this->encodeHeaderValue($fromName) . ' <' . $fromEmail . '>',
            'To: <' . $toEmail . '>',
            'Subject: ' . $this->encodeHeaderValue($subject),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            'Date: ' . date('r'),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $this->localHostname() . '>',
        ];

        if ($replyTo !== null) {
            $lines[] = 'Reply-To: <' . $replyTo . '>';
        }

        return implode("\r\n", $lines) . "\r\n";
    }

    private function encodeHeaderValue(string $value): string
    {
        // Remove quebras de linha para impedir injeção de cabeçalhos e aplica
        // codificação MIME para caracteres acentuados.
        $sanitized = str_replace(["\r", "\n"], '', $value);
        return '=?UTF-8?B?' . base64_encode($sanitized) . '?=';
    }

    private function escapeBody(string $body): string
    {
        // "Byte stuffing" do protocolo SMTP: uma linha iniciada com "." vira "..".
        $normalized = str_replace(["\r\n", "\r"], "\n", $body);
        $lines = explode("\n", $normalized);
        foreach ($lines as $index => $line) {
            if (str_starts_with($line, '.')) {
                $lines[$index] = '.' . $line;
            }
        }
        return implode("\r\n", $lines);
    }

    private function localHostname(): string
    {
        return gethostname() ?: 'localhost';
    }

    private function command(string $command, int $expectedCode): string
    {
        $this->rawWrite($command);
        return $this->expect($expectedCode);
    }

    private function rawWrite(string $data): void
    {
        if ($this->socket === null) {
            throw new RuntimeException('Conexão SMTP não iniciada.');
        }
        fwrite($this->socket, $data . "\r\n");
    }

    private function expect(int $expectedCode): string
    {
        if ($this->socket === null) {
            throw new RuntimeException('Conexão SMTP não iniciada.');
        }

        $response = '';
        while (!feof($this->socket)) {
            $line = fgets($this->socket, 515);
            if ($line === false) {
                break;
            }
            $response .= $line;
            // Linha final da resposta multi-linha usa "-" após o código; espaço indica fim.
            if (preg_match('/^\d{3} /', $line)) {
                break;
            }
        }

        $code = (int) substr($response, 0, 3);
        if ($code !== $expectedCode) {
            throw new RuntimeException("Resposta SMTP inesperada: {$response}");
        }

        return $response;
    }
}
