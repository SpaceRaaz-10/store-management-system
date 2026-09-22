<?php
declare(strict_types=1);

use App\Core\Cors;
use App\Core\Env;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Middleware\CsrfMiddleware;

require __DIR__ . '/../autoload.php';

Env::load(__DIR__ . '/../.env');

$appCfg = require __DIR__ . '/../config/app.php';
if ($appCfg['debug']) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
}

// ---- Serve uploaded files ----
// URL: /uploads/products/<file>
// Disk: backend/storage/uploads/products/<file>
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
if (str_starts_with($requestPath, '/uploads/')) {
    $relative = substr($requestPath, strlen('/uploads/'));
    $baseDir = realpath(__DIR__ . '/../storage/uploads');
    $file = $baseDir ? realpath($baseDir . DIRECTORY_SEPARATOR . $relative) : false;

    if ($baseDir && $file && str_starts_with($file, $baseDir) && is_file($file)) {
        $mime = mime_content_type($file) ?: 'application/octet-stream';
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($file));
        header('Cache-Control: public, max-age=86400');
        readfile($file);
        exit;
    }

    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'File not found',
        'requested' => $requestPath,
        'resolved' => $file ?: null,
        'baseDir' => $baseDir ?: null,
    ]);
    exit;
}

// ---- Session ----
$sess = require __DIR__ . '/../config/session.php';
session_name($sess['name']);
session_set_cookie_params([
    'lifetime' => $sess['lifetime'],
    'path'     => $sess['path'],
    'secure'   => $sess['secure'],
    'httponly' => $sess['httponly'],
    'samesite' => $sess['samesite'],
]);
session_start();

Cors::apply();
CsrfMiddleware::handle();

$router = new Router();
$register = require __DIR__ . '/../routes/api.php';
$register($router);

try {
    $router->dispatch(Request::method(), Request::path());
} catch (Throwable $e) {
    error_log($e->getMessage());
    if ($appCfg['debug']) {
        Response::error($e->getMessage(), 500);
    }
    Response::error('Internal server error', 500);
}