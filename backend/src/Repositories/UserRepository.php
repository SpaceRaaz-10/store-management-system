<?php
namespace App\Repositories;

use App\Core\Database;

class UserRepository
{
    public function findByEmail(string $email): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findById(int $id): ?array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, name, email, role, status, last_login_at, created_at, updated_at
             FROM users WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByIdWithHash(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function updateLastLogin(int $id): void
    {
        $stmt = Database::pdo()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    public function paginate(int $page, int $perPage, ?string $search, ?string $role, ?string $status): array
    {
        $where = [];
        $params = [];
        if ($search) {
            $where[] = '(name LIKE :s OR email LIKE :s)';
            $params['s'] = "%$search%";
        }
        if ($role) { $where[] = 'role = :role'; $params['role'] = $role; }
        if ($status) { $where[] = 'status = :status'; $params['status'] = $status; }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $pdo = Database::pdo();
        $count = $pdo->prepare("SELECT COUNT(*) FROM users $whereSql");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $stmt = $pdo->prepare(
            "SELECT id, name, email, role, status, last_login_at, created_at, updated_at
             FROM users $whereSql
             ORDER BY created_at DESC
             LIMIT :lim OFFSET :off"
        );
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue('lim', $perPage, \PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return ['rows' => $stmt->fetchAll(), 'total' => $total];
    }

    public function emailExists(string $email, ?int $excludeId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM users WHERE email = ?';
        $params = [$email];
        if ($excludeId !== null) { $sql .= ' AND id != ?'; $params[] = $excludeId; }
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        return (int)$stmt->fetchColumn() > 0;
    }

    public function create(array $d): int
    {
        $stmt = Database::pdo()->prepare(
            'INSERT INTO users (name, email, password_hash, role, status)
             VALUES (:name, :email, :hash, :role, :status)'
        );
        $stmt->execute([
            'name' => $d['name'],
            'email' => $d['email'],
            'hash' => $d['password_hash'],
            'role' => $d['role'],
            'status' => $d['status'],
        ]);
        return (int)Database::pdo()->lastInsertId();
    }

    public function update(int $id, array $d): void
    {
        $stmt = Database::pdo()->prepare(
            'UPDATE users SET name = :name, email = :email, role = :role, status = :status
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'name' => $d['name'],
            'email' => $d['email'],
            'role' => $d['role'],
            'status' => $d['status'],
        ]);
    }

    public function setPassword(int $id, string $hash): void
    {
        $stmt = Database::pdo()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $stmt->execute([$hash, $id]);
    }

    public function setStatus(int $id, string $status): void
    {
        $stmt = Database::pdo()->prepare('UPDATE users SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);
    }

    public function adminCount(): int
    {
        return (int)Database::pdo()->query(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'"
        )->fetchColumn();
    }
}