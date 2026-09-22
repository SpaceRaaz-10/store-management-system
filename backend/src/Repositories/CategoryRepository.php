<?php
namespace App\Repositories;

use App\Core\Database;

class CategoryRepository
{
    public function paginate(int $page, int $perPage, ?string $search, ?string $status): array
    {
        $where = [];
        $params = [];
        if ($search) { $where[] = '(name LIKE :s OR description LIKE :s)'; $params['s'] = "%$search%"; }
        if ($status) { $where[] = 'status = :status'; $params['status'] = $status; }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $pdo = Database::pdo();
        $count = $pdo->prepare("SELECT COUNT(*) FROM categories $whereSql");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $stmt = $pdo->prepare("SELECT * FROM categories $whereSql ORDER BY name ASC LIMIT :lim OFFSET :off");
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue('lim', $perPage, \PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return ['rows' => $stmt->fetchAll(), 'total' => $total];
    }

    public function findById(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM categories WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function nameExists(string $name, ?int $excludeId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM categories WHERE name = ?';
        $params = [$name];
        if ($excludeId !== null) { $sql .= ' AND id != ?'; $params[] = $excludeId; }
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        return (int)$stmt->fetchColumn() > 0;
    }

    public function create(array $d): int
    {
        $stmt = Database::pdo()->prepare(
            'INSERT INTO categories (name, description, status) VALUES (:name, :description, :status)'
        );
        $stmt->execute([
            'name' => $d['name'],
            'description' => $d['description'] ?? null,
            'status' => $d['status'] ?? 'active',
        ]);
        return (int)Database::pdo()->lastInsertId();
    }

    public function update(int $id, array $d): void
    {
        $stmt = Database::pdo()->prepare(
            'UPDATE categories SET name = :name, description = :description, status = :status WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'name' => $d['name'],
            'description' => $d['description'] ?? null,
            'status' => $d['status'] ?? 'active',
        ]);
    }

    public function setStatus(int $id, string $status): void
    {
        $stmt = Database::pdo()->prepare('UPDATE categories SET status = :s WHERE id = :id');
        $stmt->execute(['id' => $id, 's' => $status]);
    }

    public function delete(int $id): void
    {
        $stmt = Database::pdo()->prepare('DELETE FROM categories WHERE id = ?');
        $stmt->execute([$id]);
    }

    public function productCount(int $id): int
    {
        $stmt = Database::pdo()->prepare('SELECT COUNT(*) FROM products WHERE category_id = ?');
        $stmt->execute([$id]);
        return (int)$stmt->fetchColumn();
    }
}