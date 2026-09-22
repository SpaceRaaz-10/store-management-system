<?php
namespace App\Repositories;

use App\Core\Database;

class SupplierRepository
{
    public function paginate(int $page, int $perPage, ?string $search, ?string $status): array
    {
        $where = [];
        $params = [];
        if ($search) {
            $where[] = '(name LIKE :s OR contact_person LIKE :s OR phone LIKE :s OR email LIKE :s)';
            $params['s'] = "%$search%";
        }
        if ($status) { $where[] = 'status = :status'; $params['status'] = $status; }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $pdo = Database::pdo();
        $count = $pdo->prepare("SELECT COUNT(*) FROM suppliers $whereSql");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $stmt = $pdo->prepare("SELECT * FROM suppliers $whereSql ORDER BY name ASC LIMIT :lim OFFSET :off");
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue('lim', $perPage, \PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return ['rows' => $stmt->fetchAll(), 'total' => $total];
    }

    public function findById(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM suppliers WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function create(array $d): int
    {
        $stmt = Database::pdo()->prepare(
            'INSERT INTO suppliers (name, contact_person, phone, email, address, status)
             VALUES (:name, :contact_person, :phone, :email, :address, :status)'
        );
        $stmt->execute([
            'name' => $d['name'],
            'contact_person' => $d['contact_person'] ?? null,
            'phone' => $d['phone'] ?? null,
            'email' => $d['email'] ?? null,
            'address' => $d['address'] ?? null,
            'status' => $d['status'] ?? 'active',
        ]);
        return (int)Database::pdo()->lastInsertId();
    }

    public function update(int $id, array $d): void
    {
        $stmt = Database::pdo()->prepare(
            'UPDATE suppliers SET name = :name, contact_person = :contact_person, phone = :phone,
             email = :email, address = :address, status = :status WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'name' => $d['name'],
            'contact_person' => $d['contact_person'] ?? null,
            'phone' => $d['phone'] ?? null,
            'email' => $d['email'] ?? null,
            'address' => $d['address'] ?? null,
            'status' => $d['status'] ?? 'active',
        ]);
    }

    public function setStatus(int $id, string $status): void
    {
        $stmt = Database::pdo()->prepare('UPDATE suppliers SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);
    }

    public function delete(int $id): void
    {
        $stmt = Database::pdo()->prepare('DELETE FROM suppliers WHERE id = ?');
        $stmt->execute([$id]);
    }

    public function purchaseCount(int $id): int
    {
        $stmt = Database::pdo()->prepare('SELECT COUNT(*) FROM purchases WHERE supplier_id = ?');
        $stmt->execute([$id]);
        return (int)$stmt->fetchColumn();
    }
}