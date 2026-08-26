<?php

declare(strict_types=1);

/**
 * Endpoint de contato do site institucional (Astro estático + Hostinger).
 * Recebe POST em JSON, valida e sanitiza os dados, aplica proteções
 * anti-spam e envia o e-mail via SMTP. Nunca expõe detalhes internos de
 * erro na resposta.
 */

require __DIR__ . '/lib/Env.php';
require __DIR__ . '/lib/RateLimiter.php';
require __DIR__ . '/lib/SmtpMailer.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond(int $statusCode, bool $success, string $message): never
{
    http_response_code($statusCode);
    echo json_encode(['success' => $success, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function logError(string $message): void
{
    $logDir = __DIR__ . '/storage';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL;
    @file_put_contents($logDir . '/errors.log', $line, FILE_APPEND | LOCK_EX);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, false, 'Método não permitido.');
}

$rawBody = file_get_contents('php://input', length: 200_000);
if ($rawBody === false || $rawBody === '') {
    respond(400, false, 'Requisição inválida.');
}

$data = json_decode($rawBody, true);
if (!is_array($data)) {
    respond(400, false, 'Requisição inválida.');
}

// ---------- Honeypot ----------
$honeypot = trim((string) ($data['website'] ?? ''));
if ($honeypot !== '') {
    // Resposta "de sucesso" para não sinalizar ao bot que foi detectado.
    respond(200, true, 'Mensagem enviada com sucesso.');
}

// ---------- Tempo mínimo de preenchimento ----------
$loadedAt = (int) ($data['loaded_at'] ?? 0);
if ($loadedAt > 0) {
    $elapsedMs = (microtime(true) * 1000) - $loadedAt;
    if ($elapsedMs >= 0 && $elapsedMs < 2500) {
        respond(400, false, 'Não foi possível enviar sua mensagem. Tente novamente.');
    }
}

// ---------- Rate limiting ----------
$clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$clientIp = trim(explode(',', $clientIp)[0]);
$rateLimiter = new RateLimiter(__DIR__ . '/storage/rate-limit');
if ($rateLimiter->tooManyRequests($clientIp)) {
    respond(429, false, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
}

// ---------- Sanitização e validação ----------
function sanitizeLine(string $value, int $maxLength): string
{
    $value = str_replace(["\r", "\n"], ' ', $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value) ?? '';
    $value = trim($value);
    return mb_substr($value, 0, $maxLength);
}

function sanitizeMultiline(string $value, int $maxLength): string
{
    $value = str_replace("\r\n", "\n", $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value) ?? '';
    $value = trim($value);
    return mb_substr($value, 0, $maxLength);
}

$name = sanitizeLine((string) ($data['name'] ?? ''), 120);
$email = sanitizeLine((string) ($data['email'] ?? ''), 180);
$phone = sanitizeLine((string) ($data['phone'] ?? ''), 30);
$subject = sanitizeLine((string) ($data['subject'] ?? ''), 150);
$message = sanitizeMultiline((string) ($data['message'] ?? ''), 4000);
$consent = (bool) ($data['consent'] ?? false);

$errors = [];

if ($name === '') {
    $errors[] = 'nome';
}

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'e-mail';
}

if ($message === '') {
    $errors[] = 'mensagem';
}

if (!$consent) {
    $errors[] = 'consentimento';
}

if (!empty($errors)) {
    respond(400, false, 'Preencha corretamente os campos obrigatórios: ' . implode(', ', $errors) . '.');
}

// ---------- Envio ----------
$smtpHost = Env::get('SMTP_HOST');
$smtpPort = (int) Env::get('SMTP_PORT', '587');
$smtpUser = Env::get('SMTP_USERNAME');
$smtpPass = Env::get('SMTP_PASSWORD');
$fromEmail = Env::get('SMTP_FROM_EMAIL');
$fromName = Env::get('SMTP_FROM_NAME', 'Outeiral Advocacia') ?? 'Outeiral Advocacia';
$recipient = Env::get('CONTACT_RECIPIENT');

if (!$smtpHost || !$smtpUser || !$smtpPass || !$fromEmail || !$recipient) {
    logError('Configuração de SMTP incompleta — verifique public/api/.env');
    respond(500, false, 'Não foi possível enviar sua mensagem. Tente novamente mais tarde.');
}

$bodyLines = [
    'Nova mensagem recebida pelo formulário de contato do site.',
    '',
    'Nome: ' . $name,
    'E-mail: ' . $email,
];

if ($phone !== '') {
    $bodyLines[] = 'Telefone/WhatsApp: ' . $phone;
}

if ($subject !== '') {
    $bodyLines[] = 'Assunto: ' . $subject;
}

$bodyLines[] = '';
$bodyLines[] = 'Mensagem:';
$bodyLines[] = $message;
$bodyLines[] = '';
$bodyLines[] = '---';
$bodyLines[] = 'IP: ' . $clientIp;
$bodyLines[] = 'Enviado em: ' . date('d/m/Y H:i');

$emailSubject = $subject !== ''
    ? 'Contato pelo site — ' . $subject
    : 'Novo contato pelo site — ' . $name;

try {
    $mailer = new SmtpMailer($smtpHost, $smtpPort, $smtpUser, $smtpPass);
    $mailer->send(
        fromEmail: $fromEmail,
        fromName: $fromName,
        toEmail: $recipient,
        subject: $emailSubject,
        body: implode("\n", $bodyLines),
        replyTo: $email,
    );
} catch (Throwable $exception) {
    logError('Falha ao enviar e-mail: ' . $exception->getMessage());
    respond(500, false, 'Não foi possível enviar sua mensagem. Tente novamente mais tarde.');
}

respond(200, true, 'Mensagem enviada com sucesso.');
