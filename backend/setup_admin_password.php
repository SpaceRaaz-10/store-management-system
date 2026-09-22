<?php
require __DIR__ . '/autoload.php';
App\Core\Env::load(__DIR__ . '/.env');

$password = $argv[1] ?? 'Admin@123';
$hash = password_hash($password, PASSWORD_BCRYPT);

$pdo = App\Core\Database::pdo();
$stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE email = ?');
$stmt->execute([$hash, 'admin@store.local']);

echo "Password updated for admin@store.local\n";
echo "New password: $password\n";
echo "Hash: $hash\n";